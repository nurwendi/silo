# Silo Secure 🛡️

A ultra-private, WhatsApp-like communication app focused on **Zero-Knowledge** architecture and **End-to-End Encryption (E2EE)**.

## 🚀 Vision
Silo was built for users who demand absolute privacy. No data is stored on the server. Your messages, images, voice, and files are only decrypted on the devices involved in the conversation.

## ✨ Key Features
- **E2EE Chat**: AES-256-GCM encryption for all text messages.
- **Secure Multimedia**: Encrypted image, voice message (PTT), and document sharing.
- **E2EE Video/Voice Calls**: Real-time media streams encrypted via LiveKit E2EEManager.
- **Disappearing Messages**: Self-destructing messages with configurable timers (1m, 1h, 24h).
- **Zero-Storage Relay**: Node.js signaling server only relays encrypted blobs and tokens; it has no database.
- **Room Security**: One-tap "Room Lock" to prevent new joins once a session has started.
- **Premium UI**: Modern Blue/Red theme with glassmorphism and smooth interactions.

## 🛠️ Architecture
- **Frontend**: React Native (Expo) with TypeScript.
- **Backend**: Node.js, Socket.io (Signaling), LiveKit (Media).
- **Cryptography**: `@noble/ciphers` for AES-GCM, `expo-crypto` for key derivation (SHA-256).

## 🏃 Getting Started

### 1. Prerequisite
- Node.js & npm
- [LiveKit Server](https://livekit.io/) (Cloud or Self-Hosted)

### 2. Setup Server
```bash
cd server
npm install
# Create .env with LIVEKIT_API_KEY and LIVEKIT_API_SECRET
node index.js
```

### 3. Setup Frontend
```bash
npm install
npx expo start
```
Use **Expo Go** on Android/iOS to test.

## 🛡️ Privacy Protocol
1. **Derivation**: Your room password is never sent. It's used locally to derive a 256-bit key.
2. **Encryption**: Every message is encrypted with a unique IV (Initialization Vector) before leaving the device.
3. **Decryption**: The recipient uses the same room password to derive the key and decrypt the content.
4. **No Logs**: The signaling server processes relay events in-memory only.

---
Built with ❤️ for Privacy.
