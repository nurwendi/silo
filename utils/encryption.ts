import { gcm } from '@noble/ciphers/aes';
import { randomBytes } from '@noble/ciphers/utils';
import { Buffer } from 'buffer';

/**
 * Derives a 256-bit key from a string (room password)
 */
export async function deriveKey(password: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  // Simple SHA-256 for key derivation (for prototype)
  // In a real app, use PBKDF2 or Argon2
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

/**
 * Encrypts a message using AES-256-GCM
 */
export async function encryptChatMessage(message: string, key: Uint8Array): Promise<string> {
  const nonce = randomBytes(12);
  const aes = gcm(key, nonce);
  const encoder = new TextEncoder();
  const ciphertext = aes.encrypt(encoder.encode(message));
  
  // Combine nonce + ciphertext and encode as base64
  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce);
  combined.set(ciphertext, nonce.length);
  
  return Buffer.from(combined).toString('base64');
}

/**
 * Decrypts a message using AES-256-GCM
 */
export async function decryptChatMessage(encryptedBase64: string, key: Uint8Array): Promise<string> {
  try {
    const combined = Buffer.from(encryptedBase64, 'base64');
    const nonce = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    
    const aes = gcm(key, nonce);
    const decrypted = aes.decrypt(ciphertext);
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '[Encrypted Message - Key Incorrect]';
  }
}
