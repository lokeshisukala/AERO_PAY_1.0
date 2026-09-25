import sqlite3
import os

DB_FILE = "aeropay_master.db"

def init_master_db():
    print("🚀 Initializing Master Cloud Ledger...")
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Enable WAL mode for the server too!
    cursor.execute("PRAGMA journal_mode=WAL;")
    
    # Create the central sync ledger
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS global_ledger (
            transaction_hash TEXT PRIMARY KEY,
            sender_pubkey TEXT NOT NULL,
            recipient_pubkey TEXT NOT NULL,
            amount_paise INTEGER NOT NULL,
            nonce INTEGER NOT NULL,
            timestamp INTEGER NOT NULL,
            signature TEXT NOT NULL,
            synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    
    conn.commit()
    cursor.close()
    conn.close()
    print("✅ Master Ledger Created.")

if __name__ == "__main__":
    init_master_db()