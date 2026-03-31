const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { AccessToken } = require('livekit-server-sdk');
const cors = require('cors');
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

const tokenStore = new Map(); // token -> { roomId, password }

function generateToken() {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let token = '';
  for (let i = 0; i < 5; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Endpoint to generate LiveKit Access Token
app.get('/getToken', async (req, res) => {
  const room = req.query.room;
  const identity = req.query.identity;

  if (!room || !identity) {
    return res.status(400).json({ error: 'Missing room or identity' });
  }

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: identity,
  });

  at.addGrant({ roomJoin: true, room: room, canPublish: true, canSubscribe: true });

  const token = await at.toJwt();
  res.json({ token });
});

// Endpoint to register a room PIN/Token
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

// Endpoint to resolve a room PIN/Token
app.get('/resolveToken/:token', (req, res) => {
  const { token } = req.params;
  const data = tokenStore.get(token.toLowerCase());
  if (data) {
    res.json(data);
  } else {
    res.status(404).send('Token not found');
  }
});

// Socket.io for Real-time Signaling & Relay
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  socket.on('send-message', (data) => {
    const { roomId, message, sender, type, id, expiresAt } = data;
    socket.to(roomId).emit('receive-message', {
      id,
      message, 
      type,
      sender,
      timestamp: Date.now(),
      expiresAt
    });
  });

  socket.on('msg-ack', (data) => {
    const { roomId, msgId, from } = data;
    socket.to(roomId).emit('msg-delivered', { msgId, from });
  });

  socket.on('lock-room', (data) => {
    const { roomId, locked } = data;
    socket.to(roomId).emit('room-lock-status', { locked });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
