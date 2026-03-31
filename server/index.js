const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { AccessToken } = require('livekit-server-sdk');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 5e6, // 5MB
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';

// In-memory data structures (Use a DB like MongoDB/Postgres for production)
const users = new Map(); // username -> { passwordHash, salt, encryptedVault }
const tokenStore = new Map(); // token -> { roomId, password }

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function generateToken() {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let token = '';
  for (let i = 0; i < 5; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// --- AUTH API ---

app.post('/auth/signup', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send('Missing params');
  if (users.has(username)) return res.status(400).send('User already exists');

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  
  users.set(username, { passwordHash, salt, encryptedVault: null });
  res.json({ success: true });
});

app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.get(username);
  if (!user) return res.status(404).send('User not found');

  const hash = hashPassword(password, user.salt);
  if (hash === user.passwordHash) {
    res.json({ success: true, vault: user.encryptedVault });
  } else {
    res.status(401).send('Invalid password');
  }
});

// --- SYNC API ---

app.post('/sync/push', (req, res) => {
  const { username, password, vault } = req.body;
  const user = users.get(username);
  if (!user) return res.status(404).send('User not found');

  const hash = hashPassword(password, user.salt);
  if (hash === user.passwordHash) {
    user.encryptedVault = vault;
    res.json({ success: true });
  } else {
    res.status(401).send('Unauthorized');
  }
});

// --- ROOM & TOKEN API ---

app.get('/getToken', async (req, res) => {
  const { room, identity } = req.query;
  if (!room || !identity) return res.status(400).json({ error: 'Missing room or identity' });

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity });
  at.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });
  res.json({ token: await at.toJwt() });
});

app.post('/registerToken', (req, res) => {
  const { roomId, password } = req.body;
  if (!roomId || !password) return res.status(400).send('Missing params');

  let token;
  for (const [t, data] of tokenStore.entries()) {
    if (data.roomId === roomId && data.password === password) {
      token = t;
      break;
    }
  }

  if (!token) {
    token = generateToken();
    while (tokenStore.has(token)) token = generateToken();
    tokenStore.set(token, { roomId, password });
  }
  res.json({ token });
});

app.get('/resolveToken/:token', (req, res) => {
  const { token } = req.params;
  const data = tokenStore.get(token.toLowerCase());
  if (data) res.json(data);
  else res.status(404).send('Token not found');
});

// --- SOCKET.IO ---

io.on('connection', (socket) => {
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
  });

  socket.on('send-message', (data) => {
    const { roomId, message, sender, type, id, expiresAt } = data;
    socket.to(roomId).emit('receive-message', { id, message, type, sender, timestamp: Date.now(), expiresAt });
  });

  socket.on('msg-ack', (data) => {
    const { roomId, msgId, from } = data;
    socket.to(roomId).emit('msg-delivered', { msgId, from });
  });

  socket.on('lock-room', (data) => {
    socket.to(data.roomId).emit('room-lock-status', { locked: data.locked });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
