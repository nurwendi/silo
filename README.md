# Silo Secure - Zero-Knowledge E2EE Communication

Silo Secure is a privacy-first, zero-knowledge communication application for Android. It features end-to-end encrypted chat, multimedia sharing (images, voice, files), and real-time audio/video calls using LiveKit.

## 🌟 Features
- **Flat Glassmorphism UI**: Premium, modern design with transparent overlays and vibrant gradients.
- **Zero-Knowledge Architecture**: The signaling server only relays encrypted blobs; no messages or keys are stored server-side.
- **End-to-End Encryption (E2EE)**: AES-256-GCM encryption for all text, images, voice messages, and media streams.
- **WhatsApp-like Experience**: Push-to-Talk (PTT), file sharing, delivery ticks, and image previews.
- **Self-Destructing Messages**: Set timers (1m, 1h, 24h) for messages to auto-delete for all participants.
- **Room Security**: Lock rooms to prevent new participants from joining.

---

## 🚀 Installation & Setup

Follow these steps to run Silo Secure on another computer:

### 1. Prerequisites
- **Node.js**: v20 or later.
- **Expo Go**: Installed on your Android device (or an Android Emulator).
- **LiveKit Server**: You need a LiveKit instance (Self-hosted or Cloud).

### 2. Clone the Repository
```bash
git clone https://github.com/nurwendi/silo.git
cd silo
```

### 3. Install Dependencies
Install dependencies for both the App and the Signaling Server:
```bash
# Root directory (App)
npm install

# Server directory
cd server
npm install
cd ..
```

### 4. Configuration
Create a `.env` file in the `server` directory with your LiveKit credentials:
```env
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
LIVEKIT_URL=https://your-project.livekit.cloud
```

### 5. Running the Application

#### A. Start the Signaling Server
```bash
cd server
node index.js
```

#### B. Start the Expo App
Open a new terminal in the root directory:
```bash
npx expo start
```
- Scan the QR code with **Expo Go** on your Android device.
- Ensure your device is on the same network as your computer, or use a tunneling service like Ngrok for the server.

---

## 🛠 Tech Stack
- **Frontend**: React Native (Expo), TypeScript, `expo-blur`, `expo-linear-gradient`.
- **E2EE**: `@noble/ciphers` (AES-GCM), `expo-crypto`.
- **Real-time**: `socket.io-client` for signaling, `livekit-client` for media.
- **Media**: `expo-av` (Audio), `expo-image-picker`, `expo-document-picker`.

## 🔒 Security Principles
- **Local Key Derivation**: Encryption keys are derived from your room password using PBKDF2/SHA-256 entirely on your device.
- **No Persistence**: The signaling server is stateless. No chat logs, images, or audio files are saved to any database.
- **Encrypted Media**: LiveKit streams are encrypted using the same key provider, ensuring even the LiveKit server cannot see your video/audio.

---

Designed with ❤️ for absolute privacy.
