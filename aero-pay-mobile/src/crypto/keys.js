// MUST import this first to enable secure random number generation in React Native
import 'react-native-get-random-values';
import { ec as EC } from 'elliptic';

// Instantiate the Elliptic Curve context using secp256k1 (standard curve used in Bitcoin/Ethereum)
const ec = new EC('secp256k1');

/**
 * Generates a brand new ECDSA Keypair.
 * Returns: { privateKey: string (hex), publicKey: string (hex) }
 */
export const generateKeyPair = () => {
  try {
    // Generate random key pair
    const key = ec.genKeyPair();
    
    const privateKey = key.getPrivate('hex');
    const publicKey = key.getPublic('hex');

    console.log("🔑 New ECDSA Keypair generated successfully.");
    return { privateKey, publicKey };
  } catch (error) {
    console.error("❌ Key generation error:", error);
    return null;
  }
};

/**
 * Recreates a Keypair object from a saved Private Key hex string.
 * Used when signing payloads later.
 */
export const getKeyPairFromPrivate = (privateKeyHex) => {
  return ec.keyFromPrivate(privateKeyHex, 'hex');
};