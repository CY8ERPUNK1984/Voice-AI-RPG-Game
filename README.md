# Voice AI RPG Game

An interactive voice-controlled role-playing game that combines AI-powered storytelling with real-time voice interaction. Built with React frontend and Node.js backend, featuring speech-to-text input, AI game master responses, and text-to-speech output for a fully immersive RPG experience.

## Project Structure

```
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── services/        # API and service classes
│   │   ├── stores/          # Zustand state management
│   │   ├── types/           # TypeScript interfaces
│   │   ├── App.tsx          # Main App component
│   │   ├── main.tsx         # React entry point
│   │   └── index.css        # Global styles with Tailwind
│   ├── package.json         # Frontend dependencies
│   ├── tsconfig.json        # TypeScript configuration
│   ├── vite.config.ts       # Vite build configuration
│   └── tailwind.config.js   # Tailwind CSS configuration
│
├── backend/                 # Node.js backend application
│   ├── src/
│   │   ├── controllers/     # Request handlers
│   │   ├── services/        # AI services (ASR, LLM, TTS)
│   │   ├── types/           # TypeScript interfaces
│   │   └── index.ts         # Server entry point
│   ├── package.json         # Backend dependencies
│   └── tsconfig.json        # TypeScript configuration
│
└── .kiro/specs/voice-ai-rpg-game/  # Project specifications
    ├── requirements.md      # Feature requirements
    ├── design.md           # Technical design
    └── tasks.md            # Implementation tasks
```

## Technology Stack

### Frontend
- **React 18** - UI framework with TypeScript
- **Vite** - Build tool and development server
- **Tailwind CSS** - Utility-first styling framework
- **Zustand** - Lightweight state management
- **Socket.io Client** - Real-time WebSocket communication
- **Vitest** - Testing framework with jsdom environment

### Backend
- **Node.js** - Runtime environment with TypeScript
- **Express** - Web framework for REST API
- **Socket.io** - WebSocket server for real-time communication
- **tsx** - TypeScript execution for development
- **Vitest** - Testing framework

### AI Services Integration
- **ASR**: Web Speech API + OpenAI Whisper (fallback)
- **LLM**: OpenAI GPT-4 or Claude-3 for game master responses
- **TTS**: Web Speech API + OpenAI TTS (premium option)

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Install frontend dependencies:
```bash
cd frontend
npm install
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

### Development

1. Start the backend server:
```bash
cd backend
npm run dev
```

2. Start the frontend development server:
```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:3000` and the backend at `http://localhost:3001`.

### Building for Production

1. Build the frontend:
```bash
cd frontend
npm run build
```

2. Build the backend:
```bash
cd backend
npm run build
```

## Features (Planned)

- 🎮 Interactive voice-controlled RPG gameplay
- 🎤 Speech-to-text input (ASR)
- 🤖 AI-powered game master responses (LLM)
- 🔊 Text-to-speech output (TTS)
- 📚 Multiple story scenarios to choose from
- ⚙️ Customizable audio settings
- 💬 Real-time chat interface
- 🌐 WebSocket-based communication

## Current Status

✅ **Task 1 Complete**: Project structure and basic interfaces set up
- Frontend and backend directory structure created
- TypeScript configurations established
- Core dependencies installed (React, Express, Socket.io, Zustand)
- Basic TypeScript interfaces for data models defined
- Build system verified and working

✅ **Task 2 Complete**: Basic chat interface implemented
- React components for chat interface created
- Message component for user and AI messages implemented
- Auto-scrolling to new messages added
- Tailwind CSS styling applied
- Unit tests for chat components written

✅ **Task 3 Complete**: Story management system implemented
- Story model and database created
- StoryService for loading and managing stories implemented
- StorySelector component for displaying and filtering stories created
- Unit tests for story-related components written

✅ **Task 4 Complete**: WebSocket connection and session management set up
- WebSocket server with Socket.io implemented
- GameSessionManager for managing game sessions created
- WebSocket client with auto-reconnect implemented
- Event handlers for game events added
- Integration tests for WebSocket connection written

✅ **Task 5.1 Complete**: LLM service implemented
- LLMService interface and OpenAILLM class created
- Integration with OpenAI GPT API configured
- Prompt system for RPG context implemented
- Error handling and retry logic added
- Unit tests with mock OpenAI API written

✅ **Task 5.2 Complete**: LLM integrated with game sessions
- LLM service fully connected to WebSocketServer with comprehensive integration testing
- Context passing from game sessions to LLM implemented with full conversation history
- Intelligent game state tracking and updates added with automatic context extraction
- Performance monitoring with response timing and processing metrics
- Comprehensive error handling with fallback messages and graceful degradation
- Automatic context updates based on player actions and AI responses
- WebSocket LLM integration thoroughly tested with mock services and event verification

✅ **Task 6.1 Complete**: Voice input (ASR) with Web Speech API implemented
- WebSpeechASR service fully implemented with Web Speech API integration
- VoiceInput React component with recording controls and visual feedback
- Real-time speech recognition with error handling and browser compatibility checks
- Comprehensive unit tests for both ASR service and VoiceInput component
- Visual recording indicators and processing states for better UX
- Automatic fallback messaging for unsupported browsers

🔄 **Task 6.2 In Progress**: Fallback ASR with Whisper API
- WhisperASR class implementation for OpenAI Whisper integration
- Automatic switching between Web Speech API and Whisper
- Audio file handling and backend processing
- Enhanced error handling with user notifications

## WebSocket API

The game uses Socket.io for real-time communication between the frontend and backend. Here are the main events:

### Client → Server Events

- **`join-game`** - Join a game session
  ```typescript
  { storyId: string, userId: string, settings?: AudioSettings }
  ```

- **`send-message`** - Send a text message to the AI game master
  ```typescript
  string // message content
  ```

- **`voice-input`** - Send voice audio data (placeholder for future ASR)
  ```typescript
  Buffer // audio data
  ```

- **`update-settings`** - Update audio settings for the session
  ```typescript
  Partial<AudioSettings>
  ```

- **`pause-session`** - Pause the current game session
- **`resume-session`** - Resume a paused game session
- **`get-history`** - Request session message history

### Server → Client Events

- **`session-created`** - Confirms session creation
  ```typescript
  { sessionId: string, story: Story, settings: AudioSettings }
  ```

- **`message-received`** - Echoes user message back
  ```typescript
  { message: Message }
  ```

- **`ai-thinking`** - Indicates AI is generating response
  ```typescript
  { status: 'generating' }
  ```

- **`game-response`** - AI game master response
  ```typescript
  { message: Message }
  ```

- **`error`** - Error notifications
  ```typescript
  { type: string, message: string, details?: any, timestamp: Date }
  ```

### Smart Context Updates

The WebSocket server now automatically tracks and updates game context based on player interactions:

- **Character State Tracking**: Monitors inventory checks, health inquiries, and other character-related actions
- **Location Tracking**: Automatically detects location changes from AI responses using pattern matching
- **Performance Monitoring**: Tracks LLM response times for optimization
- **Fallback Handling**: Provides graceful error recovery with user-friendly fallback messages

## Next Steps

Refer to `.kiro/specs/voice-ai-rpg-game/tasks.md` for the complete implementation roadmap.