import * as crypto from 'expo-crypto';
import { encryptChatMessage, decryptChatMessage, deriveKey } from './encryption';

/**
 * Vault Schema: { tokens: string[], contacts: any[] }
 * Encrypted with the user's password.
 */

export async function encryptVault(data: any, password: string): Promise<string> {
    const key = await deriveKey(password);
    const json = JSON.stringify(data);
    return await encryptChatMessage(json, key);
}

export async function decryptVault(encryptedVault: string, password: string): Promise<any> {
    const key = await deriveKey(password);
    const decrypted = await decryptChatMessage(encryptedVault, key);
    return JSON.parse(decrypted);
}
