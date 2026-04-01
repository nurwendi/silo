# Silo Secure - Zero-Knowledge E2EE Communication

Silo Secure is a privacy-first, zero-knowledge communication application for Android. It features end-to-end encrypted chat, multimedia sharing, and real-time audio/video calls using LiveKit, all wrapped in a premium **Flat Glassmorphism** design.

## 🌟 Key Features
- **Silo Account System**: Create a secure account to sync your tokens and contacts across devices.
- **Zero-Knowledge Sync**: Your "Vault" (contacts, tokens) is encrypted locally using your password before being synced to the server.
- **Silo Tokens (BBM-style)**: Generate a 5-digit alphanumeric code to share access to encrypted rooms easily.
- **E2EE Multimedia**: AES-256-GCM encryption for text, images, PTT voice messages, and files.
- **Glassmorphism UI**: High-end visual identity with frosted glass effects and deep gradients.
- **Room Locking**: Owners can lock rooms to prevent new intruders from joining.

---

## 🚀 Installation & Setup

### 1. Prerequisites
- **Node.js**: v20 or later.
- **Expo Go**: Installed on your Android device.
- **LiveKit**: Credentials for a LiveKit Cloud or self-hosted instance.

### 2. Clone & Install
```bash
git clone https://github.com/nurwendi/silo.git
cd silo
npm install
cd server && npm install && cd ..
```

### 3. Configuration
Create a `.env` file in the `server` directory:
```env
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
LIVEKIT_URL=https://your-project.livekit.cloud
```

### 4. Running the Application

#### A. Start the Signaling Server
```bash
cd server
node index.js
```
*The server will run on **port 5000** (default).*

#### B. Start the Expo App
```bash
npx expo start
```
- Scan the QR code with **Expo Go** on Android.
- Ensure the `SIGNAL_SERVER_URL` in `app/(tabs)/index.tsx` points to your computer's local IP (e.g., `http://192.168.1.15:5000`).

---

## 🔒 Security & Privacy
- **Stateless Server**: No chat logs, images, or audio files are saved. The server is a blind relay.
- **No Cleartext Keys**: Encryption keys never leave your device.
- **Password Hashing**: Passwords are hashed using PBKDF2 with unique salts before being sent for authentication.

Designed for absolute privacy and visual excellence.
