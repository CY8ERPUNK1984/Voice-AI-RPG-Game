# API Documentation

This document describes the REST API and WebSocket events for the Voice AI RPG Game.

## Base URLs

- **Development**: `http://localhost:3001`
- **Production**: `https://your-domain.com`

## Authentication

Currently, the API does not require authentication. This may change in future versions.

## REST API Endpoints

### Health Check

#### GET /api/health

Check server health and status.

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "openai": "available",
    "websocket": "running"
  }
}
```

**Status Codes**:
- `200`: Server is healthy
- `503`: Server is unhealthy

### Game Management

#### POST /api/games

Create a new game session.

**Request Body**:
```json
{
  "storyId": "fantasy-adventure",
  "playerName": "Player1",
  "settings": {
    "difficulty": "normal",
    "voiceEnabled": true,
    "language": "en"
  }
}
```

**Response**:
```json
{
  "gameId": "game_123456",
  "sessionId": "session_789012",
  "story": {
    "id": "fantasy-adventure",
    "title": "The Enchanted Forest",
    "description": "A magical adventure awaits...",
    "genre": "fantasy"
  },
  "gameState": {
    "currentScene": "intro",
    "playerStats": {
      "health": 100,
      "experience": 0,
      "level": 1
    },
    "inventory": []
  }
}
```

**Status Codes**:
- `201`: Game created successfully
- `400`: Invalid request data
- `500`: Server error

#### GET /api/games/:gameId

Get game details and current state.

**Parameters**:
- `gameId`: Unique game identifier

**Response**:
```json
{
  "gameId": "game_123456",
  "story": { /* story details */ },
  "gameState": { /* current game state */ },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "lastActivity": "2024-01-01T01:00:00.000Z",
  "isActive": true
}
```

**Status Codes**:
- `200`: Game found
- `404`: Game not found
- `500`: Server error

#### DELETE /api/games/:gameId

End a game session.

**Parameters**:
- `gameId`: Unique game identifier

**Response**:
```json
{
  "message": "Game ended successfully",
  "gameId": "game_123456",
  "endedAt": "2024-01-01T02:00:00.000Z"
}
```

**Status Codes**:
- `200`: Game ended successfully
- `404`: Game not found
- `500`: Server error

### Story Management

#### GET /api/stories

Get available story scenarios.

**Query Parameters**:
- `genre`: Filter by genre (optional)
- `difficulty`: Filter by difficulty (optional)
- `limit`: Number of results (default: 20)
- `offset`: Pagination offset (default: 0)

**Response**:
```json
{
  "stories": [
    {
      "id": "fantasy-adventure",
      "title": "The Enchanted Forest",
      "description": "A magical adventure in an enchanted forest...",
      "genre": "fantasy",
      "difficulty": "normal",
      "estimatedDuration": "2-3 hours",
      "tags": ["magic", "adventure", "forest"],
      "thumbnail": "/images/fantasy-adventure.jpg"
    }
  ],
  "total": 10,
  "limit": 20,
  "offset": 0
}
```

**Status Codes**:
- `200`: Stories retrieved successfully
- `400`: Invalid query parameters
- `500`: Server error

#### GET /api/stories/:storyId

Get detailed information about a specific story.

**Parameters**:
- `storyId`: Unique story identifier

**Response**:
```json
{
  "id": "fantasy-adventure",
  "title": "The Enchanted Forest",
  "description": "A magical adventure in an enchanted forest...",
  "genre": "fantasy",
  "difficulty": "normal",
  "estimatedDuration": "2-3 hours",
  "tags": ["magic", "adventure", "forest"],
  "thumbnail": "/images/fantasy-adventure.jpg",
  "scenes": [
    {
      "id": "intro",
      "title": "The Forest Entrance",
      "description": "You stand at the edge of an ancient forest..."
    }
  ],
  "characters": [
    {
      "id": "wizard",
      "name": "Gandalf the Wise",
      "description": "An ancient wizard with a long white beard..."
    }
  ]
}
```

**Status Codes**:
- `200`: Story found
- `404`: Story not found
- `500`: Server error

### Audio Processing

#### POST /api/audio/transcribe

Transcribe audio to text using speech recognition.

**Request**:
- Content-Type: `multipart/form-data`
- Body: Audio file (mp3, wav, ogg, webm, m4a)

**Form Data**:
```
audio: [audio file]
language: "en" (optional)
model: "whisper-1" (optional)
```

**Response**:
```json
{
  "text": "Hello, I would like to explore the forest.",
  "confidence": 0.95,
  "language": "en",
  "duration": 3.2,
  "processingTime": 1.1
}
```

**Status Codes**:
- `200`: Transcription successful
- `400`: Invalid audio file or parameters
- `413`: File too large
- `415`: Unsupported media type
- `500`: Server error

#### POST /api/audio/synthesize

Convert text to speech using text-to-speech.

**Request Body**:
```json
{
  "text": "Welcome to the enchanted forest, brave adventurer!",
  "voice": "alloy",
  "model": "tts-1",
  "speed": 1.0,
  "format": "mp3"
}
```

**Response**:
- Content-Type: `audio/mpeg` (or requested format)
- Body: Audio file binary data

**Status Codes**:
- `200`: Synthesis successful
- `400`: Invalid request parameters
- `500`: Server error

### Session Management

#### GET /api/sessions/:sessionId

Get session information and statistics.

**Parameters**:
- `sessionId`: Unique session identifier

**Response**:
```json
{
  "sessionId": "session_789012",
  "gameId": "game_123456",
  "startTime": "2024-01-01T00:00:00.000Z",
  "lastActivity": "2024-01-01T01:30:00.000Z",
  "duration": 5400,
  "messageCount": 45,
  "voiceInteractions": 23,
  "isActive": true,
  "playerStats": {
    "health": 85,
    "experience": 150,
    "level": 2
  }
}
```

**Status Codes**:
- `200`: Session found
- `404`: Session not found
- `500`: Server error

## WebSocket Events

The WebSocket connection is established at `/socket.io/` endpoint.

### Client to Server Events

#### join-game

Join a game session.

**Payload**:
```json
{
  "gameId": "game_123456",
  "sessionId": "session_789012",
  "playerName": "Player1"
}
```

**Response**: `game-joined` event

#### send-message

Send a text message to the game.

**Payload**:
```json
{
  "message": "I want to explore the cave.",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Response**: `ai-response` event

#### voice-input

Send voice data for processing.

**Payload**:
```json
{
  "audioData": "base64-encoded-audio-data",
  "format": "webm",
  "duration": 3.2
}
```

**Response**: `voice-processed` and `ai-response` events

#### leave-game

Leave the current game session.

**Payload**:
```json
{
  "reason": "player_quit"
}
```

**Response**: `game-left` event

#### ping

Send a ping to check connection health.

**Payload**:
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Response**: `pong` event

### Server to Client Events

#### game-joined

Confirmation that player joined the game.

**Payload**:
```json
{
  "success": true,
  "gameId": "game_123456",
  "sessionId": "session_789012",
  "gameState": {
    "currentScene": "intro",
    "playerStats": { /* player stats */ },
    "inventory": []
  }
}
```

#### game-state

Current game state update.

**Payload**:
```json
{
  "gameId": "game_123456",
  "currentScene": "forest_clearing",
  "playerStats": {
    "health": 85,
    "experience": 150,
    "level": 2
  },
  "inventory": [
    {
      "id": "magic_sword",
      "name": "Enchanted Blade",
      "type": "weapon"
    }
  ],
  "availableActions": [
    "explore_north",
    "examine_tree",
    "use_item"
  ]
}
```

#### ai-response

AI-generated response to player input.

**Payload**:
```json
{
  "text": "As you venture deeper into the forest, you hear the sound of running water nearby. A small stream winds through the trees, its crystal-clear water reflecting the dappled sunlight.",
  "type": "narrative",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "audioUrl": "/api/audio/response_123.mp3",
  "choices": [
    {
      "id": "follow_stream",
      "text": "Follow the stream upstream"
    },
    {
      "id": "cross_stream",
      "text": "Cross the stream to the other side"
    }
  ]
}
```

#### voice-processed

Result of voice input processing.

**Payload**:
```json
{
  "transcription": "I want to follow the stream",
  "confidence": 0.92,
  "processingTime": 1.5,
  "success": true
}
```

#### error

Error message from the server.

**Payload**:
```json
{
  "type": "TRANSCRIPTION_ERROR",
  "message": "Failed to process audio input",
  "code": "ASR_001",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "recoverable": true,
  "retryAfter": 5000
}
```

#### connection-status

Connection health information.

**Payload**:
```json
{
  "status": "connected",
  "latency": 45,
  "quality": "excellent",
  "lastPing": "2024-01-01T00:00:00.000Z",
  "reconnectCount": 0
}
```

#### pong

Response to ping event.

**Payload**:
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "serverTime": "2024-01-01T00:00:00.100Z"
}
```

#### game-left

Confirmation that player left the game.

**Payload**:
```json
{
  "gameId": "game_123456",
  "sessionId": "session_789012",
  "reason": "player_quit",
  "finalStats": {
    "duration": 3600,
    "experience": 150,
    "level": 2
  }
}
```

## Error Handling

### HTTP Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `413`: Payload Too Large
- `415`: Unsupported Media Type
- `429`: Too Many Requests
- `500`: Internal Server Error
- `503`: Service Unavailable

### Error Response Format

```json
{
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "code": "VAL_001",
    "details": {
      "field": "storyId",
      "reason": "Story ID is required"
    },
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_123456"
  }
}
```

### WebSocket Error Types

- `CONNECTION_ERROR`: WebSocket connection issues
- `AUTHENTICATION_ERROR`: Authentication failures
- `VALIDATION_ERROR`: Invalid message format
- `GAME_ERROR`: Game logic errors
- `TRANSCRIPTION_ERROR`: Speech recognition failures
- `SYNTHESIS_ERROR`: Text-to-speech failures
- `RATE_LIMIT_ERROR`: Too many requests

## Rate Limiting

### HTTP API

- **Default**: 100 requests per 15 minutes per IP
- **Audio endpoints**: 20 requests per minute per IP
- **Game creation**: 5 games per hour per IP

### WebSocket

- **Messages**: 60 messages per minute per connection
- **Voice input**: 30 voice messages per minute per connection

### Headers

Rate limit information is included in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { io, Socket } from 'socket.io-client';

// Connect to WebSocket
const socket: Socket = io('http://localhost:3001');

// Join game
socket.emit('join-game', {
  gameId: 'game_123456',
  sessionId: 'session_789012',
  playerName: 'Player1'
});

// Listen for AI responses
socket.on('ai-response', (response) => {
  console.log('AI says:', response.text);
  if (response.audioUrl) {
    playAudio(response.audioUrl);
  }
});

// Send message
socket.emit('send-message', {
  message: 'I explore the forest',
  timestamp: new Date().toISOString()
});
```

### REST API Example

```typescript
// Create a new game
const response = await fetch('/api/games', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    storyId: 'fantasy-adventure',
    playerName: 'Player1',
    settings: {
      difficulty: 'normal',
      voiceEnabled: true
    }
  })
});

const game = await response.json();
console.log('Game created:', game.gameId);
```

## Testing

### Health Check

```bash
curl http://localhost:3001/api/health
```

### WebSocket Connection Test

```javascript
// Browser console
const socket = io('http://localhost:3001');
socket.on('connect', () => console.log('Connected'));
socket.on('disconnect', () => console.log('Disconnected'));
```

### Audio Upload Test

```bash
curl -X POST \
  -F "audio=@test.wav" \
  -F "language=en" \
  http://localhost:3001/api/audio/transcribe
```

## Changelog

### Version 1.0.0
- Initial API release
- Basic game management endpoints
- WebSocket real-time communication
- Audio processing endpoints
- Session management

### Future Versions
- Authentication and user management
- Multiplayer game support
- Advanced audio processing options
- Game analytics and statistics
- Custom story creation API