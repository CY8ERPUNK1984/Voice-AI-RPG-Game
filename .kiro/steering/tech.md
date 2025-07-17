# Technology Stack & Build System

## Frontend Stack
- **React 18** with TypeScript - UI framework with strict typing
- **Vite** - Build tool and development server
- **Tailwind CSS** - Utility-first styling framework
- **Zustand** - Lightweight state management
- **Socket.io Client** - Real-time WebSocket communication
- **Vitest** - Testing framework with jsdom environment

## Backend Stack
- **Node.js** with TypeScript - Server runtime with strict typing
- **Express** - Web framework for REST API
- **Socket.io** - WebSocket server for real-time communication
- **tsx** - TypeScript execution for development
- **Vitest** - Testing framework

## AI Services Integration
- **ASR**: Web Speech API + OpenAI Whisper (fallback)
- **LLM**: OpenAI GPT-4 or Claude-3 for game master responses
- **TTS**: Web Speech API + OpenAI TTS (premium option)

## Common Commands

### Development
```bash
# Start backend development server
cd backend && npm run dev

# Start frontend development server  
cd frontend && npm run dev

# Run both concurrently from root
npm run dev
```

### Testing
```bash
# Run frontend tests
cd frontend && npm test

# Run backend tests
cd backend && npm test
```

### Building
```bash
# Build frontend for production
cd frontend && npm run build

# Build backend for production
cd backend && npm run build
```

### Linting
```bash
# Lint frontend code
cd frontend && npm run lint

# Lint backend code
cd backend && npm run lint
```

## Development Ports
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- API proxy configured in Vite for `/api` and `/socket.io` routes