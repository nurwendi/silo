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

// Socket.io for Real-time Signaling & Relay (No Database Storage)
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  // Relay encrypted messages between participants in a room
  socket.on('send-message', (data) => {
    const { roomId, message, sender, type, id, expiresAt } = data;
    // Broadcast to others in the room
    socket.to(roomId).emit('receive-message', {
      id,
      message, 
      type,
      sender,
      timestamp: Date.now(),
      expiresAt
    });
  });

  // Handle message delivery acknowledgment
  socket.on('msg-ack', (data) => {
    const { roomId, msgId, from } = data;
    // Notify the room that the message was delivered to someone
    socket.to(roomId).emit('msg-delivered', { msgId, from });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
