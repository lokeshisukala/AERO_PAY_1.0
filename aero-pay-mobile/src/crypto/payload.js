import 'react-native-get-random-values';
import { ec as EC } from 'elliptic';
import SHA256 from 'crypto-js/sha256';

const ec = new EC('secp256k1');

/**
 * Creates a deterministic string representation of the transaction parameters.
 */
const getRawTransactionData = (senderPubKey, recipientPubKey, amountPaise, nonce, timestamp) => {
  return `${senderPubKey}:${recipientPubKey}:${amountPaise}:${nonce}:${timestamp}`;
};

/**
 * Hashes and signs a transaction payload using the sender's private key.
 */
export const createSignedPayload = (senderPrivateKey, senderPubKey, recipientPubKey, amountPaise, nonce) => {
  try {
    const timestamp = Date.now();
    const rawData = getRawTransactionData(senderPubKey, recipientPubKey, amountPaise, nonce, timestamp);
    
    // Hash the raw transaction string
    const hash = SHA256(rawData).toString();

    // Sign the hash with the sender's private key
    const key = ec.keyFromPrivate(senderPrivateKey, 'hex');
    const signature = key.sign(hash).toDER('hex');

    const payload = {
      senderPubKey,
      recipientPubKey,
      amountPaise,
      nonce,
      timestamp,
      signature
    };

    console.log("✍️ Transaction payload created and signed successfully.");
    return payload;
  } catch (error) {
    console.error("❌ Signing error:", error);
    return null;
  }
};

/**
 * Verifies an offline payload signature using ONLY the sender's public key.
 * Runs completely offline on the receiver's phone!
 */
export const verifyPayloadSignature = (payload) => {
  try {
    const { senderPubKey, recipientPubKey, amountPaise, nonce, timestamp, signature } = payload;
    
    // Reconstruct the exact same raw data string
    const rawData = getRawTransactionData(senderPubKey, recipientPubKey, amountPaise, nonce, timestamp);
    const hash = SHA256(rawData).toString();

    // Load sender's public key
    const key = ec.keyFromPublic(senderPubKey, 'hex');

    // Verify signature against hash
    const isValid = key.verify(hash, signature);

    if (isValid) {
      console.log("✅ Offline Signature Verification SUCCESSFUL!");
    } else {
      console.warn("❌ Offline Signature Verification FAILED! Fake or altered transaction!");
    }

    return isValid;
  } catch (error) {
    console.error("❌ Signature verification error:", error);
    return false;
  }
};