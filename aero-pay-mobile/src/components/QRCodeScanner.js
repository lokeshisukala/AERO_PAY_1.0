import React, { useState } from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function QRCodeScanner({ onScanSuccess }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  // Handle Camera Permissions
  if (!permission) {
    return <View />;
  }
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>AERO_Pay needs camera access to scan payments.</Text>
        <Button onPress={requestPermission} title="Grant Camera Permission" color="#00E676" />
      </View>
    );
  }

  // Handle the actual scan event
  const handleBarcodeScanned = ({ data }) => {
    setScanned(true);
    try {
      // Parse the JSON payload from the QR string
      const payload = JSON.parse(data);
      console.log("📷 QR Code Scanned Successfully!");
      
      // Pass it back to App.js to run the cryptography check
      onScanSuccess(payload);
    } catch (error) {
      console.warn("❌ Invalid QR Format Scanned.");
      alert("Invalid QR Code. This is not an AERO_Pay transaction.");
      setTimeout(() => setScanned(false), 2500); // Reset after error
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />
      
      {/* Target Overlay UI */}
      <View style={styles.overlay}>
        <View style={styles.scanTarget} />
        <Text style={styles.helperText}>Align QR code within the frame</Text>
      </View>

      {scanned && (
        <Button title="Tap to Scan Again" onPress={() => setScanned(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 400,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative', // Fixes layout on Android
    backgroundColor: '#000',
  },
  camera: {
    flex: 1, // Properly fills the parent container
    width: '100%',
  },
  center: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
  },
  text: {
    color: '#FFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10, // Ensures the green box is forcefully rendered ABOVE the camera
  },
  scanTarget: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: '#00E676',
    backgroundColor: 'transparent',
  },
  helperText: {
    color: '#FFF',
    marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 5,
  }
});