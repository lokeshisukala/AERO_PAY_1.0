import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('aeropay.db');

// 🔴 CRITICAL: Replace this IP with your laptop's actual IPv4 address!
const BACKEND_URL = 'http://10.120.231.121:8000/api/v1/sync';
export const pushOfflineTransactions = async () => {
  try {
    console.log("🔄 Starting Cloud Sync...");

    // 1. Fetch all PENDING transactions from the local database
    const pendingRecords = db.getAllSync(`SELECT * FROM sync_queue WHERE sync_status = 'PENDING';`);
    
    if (pendingRecords.length === 0) {
      console.log("✅ No pending transactions to sync.");
      return { success: true, message: "Ledger is up to date." };
    }

    // 2. Parse the payload blobs back into JSON objects
    const transactions = pendingRecords.map(record => JSON.parse(record.payload_blob));

    // 3. Send to FastAPI Server
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions })
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const result = await response.json();

    // 4. Update the local database for successfully synced transactions
    if (result.synced_transaction_ids && result.synced_transaction_ids.length > 0) {
      db.execSync('BEGIN TRANSACTION;');
      
      for (const txId of result.synced_transaction_ids) {
        db.execSync(`UPDATE sync_queue SET sync_status = 'SYNCED' WHERE transaction_id = '${txId}';`);
      }
      
      db.execSync('COMMIT;');
    }

    console.log(`✅ Sync Complete: ${result.synced_count} transactions reconciled.`);
    return { success: true, message: `Successfully synced ${result.synced_count} transactions.` };

  } catch (error) {
    console.error("❌ Cloud Sync Failed:", error.message);
    return { success: false, message: "Could not connect to Cloud Ledger." };
  }
};