import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

export default function QRCodeDisplay({ payloadData }) {
  // Convert the payload object to a compressed JSON string
  const qrString = JSON.stringify(payloadData);

  return (
    <View style={styles.container}>
      <View style={styles.qrWrapper}>
        <QRCode
          value={qrString}
          size={250}
          color="black"
          backgroundColor="white"
        />
      </View>
      <Text style={styles.helperText}>Scan this to receive payment</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 20,
  },
  qrWrapper: {
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  helperText: {
    color: '#888',
    marginTop: 15,
    fontSize: 14,
    fontWeight: 'bold',
  }
});