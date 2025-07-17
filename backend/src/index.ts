// Backend entry point
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameController } from './controllers/gameController';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize game controller with Socket.IO server
const gameController = new GameController(io);

// Basic health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Voice AI RPG Backend is running' });
});

// API endpoint to get all stories
app.get('/api/stories', async (_req, res) => {
  try {
    const stories = await gameController.getStories();
    res.json(stories);
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// API endpoint to get a story by ID
app.get('/api/stories/:id', async (req, res) => {
  try {
    const story = await gameController.getStoryById(req.params.id);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    res.json(story);
  } catch (error) {
    console.error('Error fetching story:', error);
    res.status(500).json({ error: 'Failed to fetch story' });
  }
});

// Setup periodic cleanup of old sessions (every hour)
setInterval(() => {
  const cleaned = gameController.cleanupOldSessions(24);
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} old sessions`);
  }
}, 60 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Game controller initialized with WebSocket server');
});