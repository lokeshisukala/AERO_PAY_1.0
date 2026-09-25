import * as SQLite from 'expo-sqlite';

// 1. Open or create the local database file
const db = SQLite.openDatabaseSync('aeropay.db');

export const initializeDatabase = () => {
  try {
    console.log("🚀 Initializing AERO_Pay Local Database...");

    // 2. Enable WAL mode. If the phone battery dies mid-transaction, 
    // the DB won't corrupt. It logs the intent first.
    db.execSync('PRAGMA journal_mode = WAL;');

    // 3. Create the Tables
    db.execSync(`
      -- Table 1: Stores your current available money locally
      CREATE TABLE IF NOT EXISTS wallet_balance (
        account_id TEXT PRIMARY KEY,
        balance_paise INTEGER NOT NULL CHECK (balance_paise >= 0),
        last_updated_at INTEGER NOT NULL
      );

      -- Table 2: Tracks the sequence numbers to prevent double-spending replay attacks
      CREATE TABLE IF NOT EXISTS nonce_ledger (
        device_pubkey TEXT PRIMARY KEY,
        last_seen_nonce INTEGER NOT NULL
      );

      -- Table 3: The queue of payments waiting to be sent to the FastAPI server when internet returns
      CREATE TABLE IF NOT EXISTS sync_queue (
        transaction_id TEXT PRIMARY KEY,
        payload_blob TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        sync_status TEXT DEFAULT 'PENDING' CHECK (sync_status IN ('PENDING', 'SYNCED', 'FAILED'))
      );
    `);
    
    console.log("✅ Database tables created successfully.");
    return true;
  } catch (error) {
    console.error("❌ Database initialization error:", error);
    return false;
  }
};

import SHA256 from 'crypto-js/sha256'; // We need this to create a unique ID for the sync queue

/**
 * Executes an atomic database transaction to update the wallet balance
 * and log the payment into the sync queue.
 * 
 * @param {Object} payload The signed 214-byte JSON object
 * @param {boolean} isSender TRUE if deducting money, FALSE if receiving money
 */
/**
 * Executes an atomic database transaction to update the wallet balance
 * and log the payment into the sync queue.
 * 
 * @param {Object} payload The signed 214-byte JSON object
 * @param {boolean} isSender TRUE if deducting money, FALSE if receiving money
 */
export const processOfflineTransaction = (payload, isSender) => {
  try {
    const { senderPubKey, recipientPubKey, amountPaise, nonce, timestamp, signature } = payload;
    
    const transactionId = SHA256(signature + timestamp).toString();
    const payloadBlob = JSON.stringify(payload);

    // 1. Begin Atomic Transaction
    db.execSync('BEGIN TRANSACTION;');

    // 2. Update Balance
    const amountModifier = isSender ? -amountPaise : amountPaise;
    
    db.runSync(`
      INSERT OR IGNORE INTO wallet_balance (account_id, balance_paise, last_updated_at) 
      VALUES (?, ?, ?); 
    `, ['MY_WALLET', 50000, Date.now()]);
    
    db.runSync(`
      UPDATE wallet_balance 
      SET balance_paise = balance_paise + ?, 
          last_updated_at = ? 
      WHERE account_id = ?;
    `, [amountModifier, Date.now(), 'MY_WALLET']);

    // 3. 🟢 THE FIX: INSERT OR IGNORE 
    // This allows you to act as both Sender and Receiver on the exact same phone!
    db.runSync(`
      INSERT OR IGNORE INTO sync_queue (transaction_id, payload_blob, created_at, sync_status)
      VALUES (?, ?, ?, ?);
    `, [transactionId, payloadBlob, timestamp, 'PENDING']);

    // 4. If Receiver, track the Nonce to prevent Double-Spending
    if (!isSender) {
      db.runSync(`
        INSERT OR REPLACE INTO nonce_ledger (device_pubkey, last_seen_nonce)
        VALUES (?, ?);
      `, [senderPubKey, nonce]);
    }

    // 5. Commit all changes safely to disk
    db.execSync('COMMIT;');
    console.log(`✅ DB Commit Success: ${isSender ? 'Sent' : 'Received'} ₹${amountPaise / 100}`);
    
    const pendingRecords = db.getAllSync(`SELECT * FROM sync_queue;`);
    console.log(`📦 Current Sync Queue Size: ${pendingRecords.length}`);
    
    return true;

  } catch (error) {
    db.execSync('ROLLBACK;');
    console.error("❌ DB Commit Failed. Transaction Rolled Back.", error);
    return false;
  }
};
/**
 * Queries the database to find the last known nonce (timestamp) 
 * for a specific sender's public key.
 * 
 * @param {string} senderPubKey The sender's public key to check
 * @returns {number|null} The last seen nonce, or null if never seen before.
 */
export const getLastSeenNonce = (senderPubKey) => {
  try {
    const result = db.getFirstSync(
      `SELECT last_seen_nonce FROM nonce_ledger WHERE device_pubkey = '${senderPubKey}';`
    );
    return result ? result.last_seen_nonce : null;
  } catch (error) {
    console.error("❌ Failed to query nonce ledger:", error);
    return null;
  }
};