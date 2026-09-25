from ecdsa import VerifyingKey, SECP256k1, BadSignatureError
from ecdsa.util import sigdecode_der

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
from typing import List
import sqlite3
import hashlib
from ecdsa import VerifyingKey, SECP256k1, BadSignatureError
from contextlib import asynccontextmanager
from database import init_master_db, DB_FILE

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_master_db()
    yield

app = FastAPI(title="AERO_Pay Cloud Reconciliation Engine", lifespan=lifespan)

# Pydantic schema for inbound payload validation
class PayloadModel(BaseModel):
    senderPubKey: str
    recipientPubKey: str
    amountPaise: int
    nonce: int
    timestamp: int
    signature: str

class SyncBatchRequest(BaseModel):
    transactions: List[PayloadModel]

def verify_ecdsa_signature(sender_pubkey_hex: str, raw_data_str: str, signature_hex: str) -> bool:
    """Verifies secp256k1 DER signature against raw payload data string using SHA-256."""
    try:
        # Load public key bytes
        vk = VerifyingKey.from_string(bytes.fromhex(sender_pubkey_hex), curve=SECP256k1)
        # Compute SHA-256 digest of payload string
        hash_bytes = hashlib.sha256(raw_data_str.encode('utf-8')).digest()
        
        # Verify DER signature (Tell Python to expect 70-72 bytes instead of 64)
        return vk.verify_digest(bytes.fromhex(signature_hex), hash_bytes, sigdecode=sigdecode_der)
    except Exception as e:
        print(f"❌ Signature verification failure: {e}")
        return False
@app.post("/api/v1/sync", status_code=status.HTTP_200_OK)
def sync_offline_ledger(batch: SyncBatchRequest):
    synced_hashes = []
    failed_hashes = []

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    try:
        for tx in batch.transactions:
            # 1. Reconstruct raw transaction string matching client specification
            raw_data_str = f"{tx.senderPubKey}:{tx.recipientPubKey}:{tx.amountPaise}:{tx.nonce}:{tx.timestamp}"
            
            # 2. Compute unique transaction hash for idempotency check
            tx_hash = hashlib.sha256((tx.signature + str(tx.timestamp)).encode('utf-8')).hexdigest()

            # 3. Cryptographic Signature Validation
            if not verify_ecdsa_signature(tx.senderPubKey, raw_data_str, tx.signature):
                print(f"⚠️ Fraudulent transaction signature detected for hash: {tx_hash}")
                failed_hashes.append(tx_hash)
                continue

            # 4. Insert into Master Ledger (INSERT OR IGNORE handles duplicate syncs)
            cursor.execute("""
                INSERT OR IGNORE INTO global_ledger 
                (transaction_hash, sender_pubkey, recipient_pubkey, amount_paise, nonce, timestamp, signature)
                VALUES (?, ?, ?, ?, ?, ?, ?);
            """, (tx_hash, tx.senderPubKey, tx.recipientPubKey, tx.amountPaise, tx.nonce, tx.timestamp, tx.signature))

            synced_hashes.append(tx_hash)

        conn.commit()
        print(f"✅ Sync Complete: {len(synced_hashes)} transactions written to Master Ledger.")

        return {
            "status": "SUCCESS",
            "synced_count": len(synced_hashes),
            "synced_transaction_ids": synced_hashes,
            "failed_transaction_ids": failed_hashes
        }

    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Reconciliation error: {str(e)}"
        )
    finally:
        cursor.close()
        conn.close()
    
@app.get("/")
def read_root():
    return {"status": "AERO_Pay Backend is ONLINE. Ready for Sync."}