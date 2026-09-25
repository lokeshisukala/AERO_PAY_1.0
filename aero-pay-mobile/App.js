import { useEffect, useState, useRef } from 'react'; // Added useRef
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert } from 'react-native';
import * as SQLite from 'expo-sqlite';

import { initializeDatabase, processOfflineTransaction, getLastSeenNonce } from './src/db/database'; 
import { generateKeyPair } from './src/crypto/keys';
import { createSignedPayload, verifyPayloadSignature } from './src/crypto/payload';
import QRCodeDisplay from './src/components/QRCodeDisplay';
import QRCodeScanner from './src/components/QRCodeScanner';
import { pushOfflineTransactions } from './src/network/sync';

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [wallet, setWallet] = useState(null);
  
  // UI State
  const [mode, setMode] = useState('home'); 
  const [transactionPayload, setTransactionPayload] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  
  // 🔐 THE SYNCHRONOUS PADLOCK: Stops the camera from firing multiple times
  const scanLock = useRef(false); 

  useEffect(() => {
    const setup = () => {
      // WIPE DATABASE ONLY ONCE FOR THIS TEST (Remove later)
      try {
        SQLite.deleteDatabaseSync('aeropay.db');
      } catch (e) {}

      const dbSuccess = initializeDatabase();
      if (!dbSuccess) return;
      setDbReady(true);
      
      const myWallet = generateKeyPair();
      setWallet(myWallet);
    };
    setup();
  }, []);

  const handlePayOffline = () => {
    const recipientPubKey = "dummy_vendor_pub_key_12345";
    const payload = createSignedPayload(
      wallet.privateKey,
      wallet.publicKey,
      recipientPubKey,
      2000, 
      1
    );
    
    processOfflineTransaction(payload, true); 
    setTransactionPayload(payload);
    setMode('pay');
  };

  const handleScanSuccess = (payload) => {
    // 1. CHECK THE PADLOCK: If it is locked, instantly reject this camera frame.
    if (scanLock.current === true) return; 
    
    // 2. LOCK THE PADLOCK: The very first frame locks it instantly.
    scanLock.current = true; 
    
    console.log("⚡ First frame captured. Padlock engaged. Processing...");

    const lastSeenNonce = getLastSeenNonce(payload.senderPubKey);

    // Anti-Replay Attack Logic
    if (lastSeenNonce !== null && payload.nonce <= lastSeenNonce) {
      console.warn("🛑 DOUBLE-SPEND DETECTED!");
      setScanResult({
        amount: payload.amountPaise / 100,
        sender: payload.senderPubKey.substring(0, 10) + '...',
        isValid: false, 
        isReplayError: true 
      });
      return; 
    }

    const isValid = verifyPayloadSignature(payload);
    
    // Process Database Transaction securely now that we are isolated from camera spam
    if (isValid) {
      const dbSuccess = processOfflineTransaction(payload, false);
      if (!dbSuccess) {
        Alert.alert("Database Error", "Failed to save transaction locally.");
      }
    }
    
    setScanResult({
      amount: payload.amountPaise / 100,
      sender: payload.senderPubKey.substring(0, 10) + '...',
      isValid: isValid,
      isReplayError: false
    });
  };

  if (!dbReady || !wallet) return <View style={styles.container}><Text style={styles.text}>Loading Engine...</Text></View>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>AERO_Pay</Text>
      
      {mode === 'pay' && (
        <View style={styles.card}>
          <Text style={styles.title}>Transmitting Payload...</Text>
          <QRCodeDisplay payloadData={transactionPayload} />
          <TouchableOpacity style={styles.button} onPress={() => setMode('home')}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'receive' && (
        <View style={styles.card}>
          <Text style={styles.title}>Awaiting Payment...</Text>
          
          {!scanResult ? (
            <QRCodeScanner onScanSuccess={handleScanSuccess} />
          ) : (
            <View style={styles.resultBox}>
              <Text style={styles.title}>Transaction Detected!</Text>
              <Text style={styles.text}>Amount: ₹{scanResult.amount}</Text>
              <Text style={styles.text}>From: {scanResult.sender}</Text>
              
              <Text style={[styles.status, { color: scanResult.isValid ? '#00E676' : '#FF5252' }]}>
                {scanResult.isReplayError 
                    ? "❌ FORGERY ATTEMPT DETECTED:\nThis transaction has already been scanned!" 
                    : scanResult.isValid 
                      ? "✅ CRYPTO SIGNATURE VERIFIED\n(Saved to Local Ledger)" 
                      : "❌ SIGNATURE INVALID / FORGED"
                }
              </Text>
            </View>
          )}

          <TouchableOpacity 
            style={styles.button} 
            onPress={() => { 
              setMode('home'); 
              setScanResult(null); 
              // 🔓 UNLOCK THE PADLOCK: Ready for a completely new scan
              scanLock.current = false; 
            }}
          >
            <Text style={styles.buttonText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'home' && (
        <View style={styles.card}>
          <Text style={styles.text}>Hardware Enclave: ACTIVE</Text>
          <Text style={styles.text}>Local Database: ACID WAL ENABLED</Text>
          
          <TouchableOpacity style={[styles.button, { marginTop: 30 }]} onPress={handlePayOffline}>
            <Text style={styles.buttonText}>📤 PAY OFFLINE (Generate QR)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, { backgroundColor: '#1E88E5' }]} onPress={() => setMode('receive')}>
            <Text style={styles.buttonText}>📥 RECEIVE (Scan QR)</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#FF9800', marginTop: 30 }]} 
            onPress={async () => {
              Alert.alert("Syncing", "Connecting to Cloud Backend...");
              const result = await pushOfflineTransactions();
              Alert.alert("Sync Result", result.message);
            }}
          >
            <Text style={styles.buttonText}>🔄 SYNC WITH CLOUD</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#121212', alignItems: 'center', padding: 20, paddingTop: 60 },
  header: { color: '#00E676', fontSize: 28, fontWeight: 'bold', marginBottom: 30, letterSpacing: 2 },
  card: { backgroundColor: '#1E1E1E', padding: 20, borderRadius: 10, width: '100%', alignItems: 'center' },
  title: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  text: { color: '#AAA', fontSize: 14, marginBottom: 8 },
  button: { backgroundColor: '#00E676', padding: 15, borderRadius: 8, width: '100%', alignItems: 'center', marginTop: 15 },
  buttonText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  resultBox: { padding: 20, backgroundColor: '#2C2C2C', borderRadius: 8, marginTop: 20, width: '100%', alignItems: 'center' },
  status: { fontSize: 16, fontWeight: 'bold', marginTop: 15, textAlign: 'center' }
});