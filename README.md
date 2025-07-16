# Voice AI RPG Game

An interactive voice-controlled role-playing game built with React and Node.js.

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
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **Socket.io Client** - Real-time communication

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **TypeScript** - Type safety
- **Socket.io** - WebSocket server
- **Axios** - HTTP client for AI services

### AI Services
- **ASR**: Web Speech API + OpenAI Whisper (fallback)
- **LLM**: OpenAI GPT-4 or Claude-3
- **TTS**: Web Speech API + OpenAI TTS (premium)

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

## Next Steps

Refer to `.kiro/specs/voice-ai-rpg-game/tasks.md` for the complete implementation roadmap.