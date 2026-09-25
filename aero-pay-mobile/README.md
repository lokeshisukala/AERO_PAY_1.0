# AERO_Pay (v1.0) 🚀
**Asynchronous Edge Routing for Offline Payments**

AERO_Pay is an offline-first, mathematically secure peer-to-peer payment application designed for environments with zero internet connectivity. It allows users to generate, transmit, and securely verify financial transactions locally, syncing with a cloud ledger only when connectivity is restored.

## 🧠 System Architecture

AERO_Pay operates on a "Digital Chequebook" paradigm, splitting the system into three distinct layers:

1. **The Edge Enclave (React Native & Crypto):** Transactions are authorized locally using `secp256k1` ECDSA cryptographic signatures. The math mathematically proves ownership and authorization without requiring a live server ping.
2. **The Local Ledger (SQLite with WAL):** Transactions are recorded atomically into an embedded SQLite database using Write-Ahead Logging (WAL) to ensure ACID compliance and prevent data corruption during hardware crashes.
3. **The Master Cloud (FastAPI):** A Python-based reconciliation server that processes deferred sync queues, verifies DER-formatted signatures, and maintains global idempotency.

## 🛡️ Core Security Features

* **Zero-Trust Local Verification:** The receiver's phone independently verifies the sender's cryptographic signature offline before accepting the payment.
* **Anti-Double-Spend Lock:** Implements a strict Nonce Ledger. The database records the exact timestamp of every accepted transaction payload and physically locks the event loop to block replay attacks (duplicate QR scans).
* **Idempotent Cloud Sync:** The FastAPI backend ensures that asynchronous batch uploads cannot trigger duplicate ledger entries, even on poor networks.

## 🛠️ Tech Stack

* **Frontend & Transport:** React Native (Expo), QR Code Data Transfer
* **Local Database:** `expo-sqlite` (ACID & WAL enabled)
* **Cryptography:** `crypto-js`, `elliptic` (secp256k1 curve)
* **Cloud Backend:** Python, FastAPI, Uvicorn, `ecdsa`

## 🚀 Running the Project Locally

**1. Start the Cloud Ledger (Backend)**
\`\`\`bash
cd aero-pay-backend
pip install fastapi uvicorn ecdsa
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
\`\`\`
*(Ensure your firewall allows local traffic on port 8000)*

**2. Start the Mobile Client (Frontend)**
\`\`\`bash
cd aero-pay-mobile
npm install
npx expo start -c
\`\`\`
*(Update `BACKEND_URL` in `src/network/sync.js` with your machine's exact IPv4 address)*

## 🛣️ Roadmap (v2.0)
While v1.0 relies on QR codes for the physical transport layer, the underlying consensus engine is transport-agnostic. 
* [ ] Replace QR transport with Bluetooth Low Energy (BLE)
* [ ] Integrate NFC Host Card Emulation (HCE)
* [ ] UI/UX Overhaul & Animation Polish
* [ ] AI Assistant Integration
