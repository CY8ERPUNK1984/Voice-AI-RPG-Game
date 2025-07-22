# Voice AI RPG Game

🎮 An interactive voice-controlled role-playing game that combines AI-powered storytelling with real-time voice interaction.

## ✨ Features

- **🎙️ Voice-Controlled Gameplay**: Use speech-to-text (ASR) for natural game interaction
- **🤖 AI Game Master**: Powered by OpenAI GPT-4 for intelligent, contextual responses
- **🔊 Immersive Audio**: Text-to-speech output with customizable voice settings
- **📚 Multiple Stories**: Choose from fantasy, sci-fi, mystery, adventure, and horror scenarios
- **⚡ Real-time Communication**: WebSocket-based instant responses
- **🎛️ Customizable Settings**: Adjust audio, voice speed, and sensitivity
- **🌐 Cross-Platform**: Works on desktop and mobile browsers
- **♿ Accessibility**: Full keyboard navigation, screen reader support, and ARIA labels

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- OpenAI API key (for AI features)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd voice-ai-rpg-game

# Install all dependencies
npm run install:all

# Set up environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Add your OpenAI API key to backend/.env
# OPENAI_API_KEY=your_actual_api_key_here

# Start development servers
npm run dev
```

Open http://localhost:3000 and start your adventure! 🎯

## 🏗️ Architecture

### Connection Management

The application features a robust connection management system built around the `ConnectionManager` service:

#### Key Features
- **Automatic Reconnection**: Exponential backoff retry logic with configurable parameters
- **Health Monitoring**: Real-time connection quality assessment based on latency
- **State Persistence**: Connection state saved to localStorage for recovery across page reloads
- **Heartbeat System**: Regular ping/pong monitoring to detect connection issues
- **Event-Driven Architecture**: Clean separation of concerns with event listeners

#### Connection States
- `connecting` - Initial connection attempt
- `connected` - Successfully connected with heartbeat active
- `disconnected` - Connection lost, attempting reconnection
- `reconnecting` - Actively trying to reconnect with backoff delay
- `failed` - Max reconnection attempts exceeded

#### Connection Quality Metrics
- `excellent` - Latency < 100ms
- `good` - Latency < 300ms  
- `poor` - Latency < 1000ms
- `critical` - Latency > 1000ms or disconnected

### Frontend (React + TypeScript)
- **React 18** with modern hooks and concurrent features
- **Vite** for lightning-fast development and builds
- **Tailwind CSS** for responsive, utility-first styling
- **Zustand** for lightweight state management
- **Socket.io Client** with enhanced ConnectionManager for reliable real-time communication
- **Web Speech API** + **OpenAI Whisper** for voice input
- **Web Speech API** + **OpenAI TTS** for voice output
- **Modern React patterns** with proper event handling and state management
- **Robust connection management** with automatic reconnection and health monitoring

### Backend (Node.js + TypeScript)
- **Express** server with TypeScript
- **Socket.io** for WebSocket communication with heartbeat support
- **OpenAI API** integration (GPT-4, Whisper, TTS)
- **Multer** for audio file handling
- **Comprehensive error handling** and fallback mechanisms
- **Connection health monitoring** with automatic cleanup

### AI Services Integration
- **ASR**: Web Speech API (primary) + OpenAI Whisper (fallback)
- **LLM**: OpenAI GPT-4 for game master responses
- **TTS**: Web Speech API (primary) + OpenAI TTS (premium)

## 📁 Project Structure

```
voice-ai-rpg-game/
├── 📁 frontend/              # React application
│   ├── 📁 src/
│   │   ├── 📁 components/    # React components
│   │   ├── 📁 services/      # API clients & integrations
│   │   ├── 📁 types/         # TypeScript definitions
│   │   └── 📁 utils/         # Utility functions
│   └── 📁 dist/             # Built frontend
├── 📁 backend/               # Node.js server
│   ├── 📁 src/
│   │   ├── 📁 controllers/   # Route handlers
│   │   ├── 📁 services/      # Business logic
│   │   ├── 📁 data/          # Story data
│   │   └── 📁 types/         # TypeScript definitions
│   └── 📁 dist/             # Built backend
├── 📁 e2e/                  # End-to-end tests
├── 📁 .kiro/specs/          # Project specifications
└── 📄 Documentation files
```

## 🎮 How to Play

1. **Choose Your Adventure**: Select from available story scenarios
2. **Voice Interaction**: Click the microphone and speak your actions
3. **AI Responses**: The AI game master responds with voice and text
4. **Customize Experience**: Adjust audio settings to your preference
5. **Explore & Enjoy**: Use natural language to interact with the game world

### Example Commands
- "I want to explore the mysterious forest"
- "Check my inventory"
- "Talk to the merchant about the ancient artifact"
- "Cast a fireball spell at the dragon"
- "Look around for clues"

## 🛠️ Available Scripts

### Development
```bash
npm run dev              # Start both frontend and backend
npm run dev:frontend     # Start only frontend
npm run dev:backend      # Start only backend
```

### Building
```bash
npm run build           # Build both applications
npm run build:frontend  # Build only frontend
npm run build:backend   # Build only backend
```

### Testing
```bash
npm run test           # Run all tests
npm run test:unit      # Run unit tests only
npm run test:e2e       # Run end-to-end tests
npm run test:e2e:ui    # Run E2E tests with UI
```

### Utilities
```bash
npm run lint           # Lint all code
npm run clean          # Clean build artifacts
npm run reset          # Clean and reinstall everything
```

## 🌐 Browser Support

| Browser | Version | Voice Features |
|---------|---------|----------------|
| Chrome  | 80+     | ✅ Full Support |
| Firefox | 80+     | ⚠️ Limited Voice |
| Safari  | 14+     | ⚠️ Limited Voice |
| Edge    | 80+     | ✅ Full Support |

**Note**: Voice features require HTTPS in production and microphone permissions.

## ⚙️ Configuration

### Environment Variables

#### Backend (.env)
```env
NODE_ENV=development
PORT=3001
OPENAI_API_KEY=your_openai_api_key_here
AUDIO_TEMP_DIR=temp/audio
MAX_AUDIO_FILE_SIZE=25000000
```

#### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
VITE_ENABLE_VOICE_FEATURES=true
```

## 🧪 Testing

The project includes comprehensive testing with accessibility compliance:

- **Unit Tests**: Component and service testing with Vitest
- **Accessibility Tests**: ARIA labels, keyboard navigation, and screen reader support
- **Integration Tests**: API and WebSocket testing
- **E2E Tests**: Full user journey testing with Playwright
- **Performance Tests**: Audio pipeline optimization tests

```bash
# Run specific test suites
npm run test:frontend    # Frontend unit tests
npm run test:backend     # Backend unit tests
npm run test:e2e         # End-to-end tests
```

### Testing Features
- **Loading State Testing**: Proper ARIA labeling for loading indicators
- **Voice Component Testing**: ASR and TTS functionality validation
- **WebSocket Testing**: Real-time communication reliability
- **Error Handling Testing**: Graceful degradation scenarios
- **Component Integration Testing**: ChatInterface and voice input coordination
- **TypeScript Compliance Testing**: Strict type checking and modern React patterns

## 🚀 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy
```bash
# Build for production
npm run build

# Start production servers
npm run start
```

## 🎯 Current Status

✅ **Fully Integrated Application** - All major components working together
- Complete voice pipeline (ASR → LLM → TTS)
- Real-time Socket.io communication between frontend and backend
- Story selection and game session management
- Comprehensive error handling and fallback mechanisms
- Audio settings with persistent storage
- Loading states and user feedback
- Cross-browser compatibility

✅ **Production Ready Features**
- Environment configuration
- Build optimization
- Error boundaries and graceful degradation
- Performance monitoring
- WCAG 2.1 accessibility compliance with ARIA labels
- Mobile responsiveness
- Comprehensive test coverage with accessibility testing

✅ **Recent Improvements**
- **Enhanced Connection Reliability**: New ConnectionManager service with exponential backoff retry logic
- **Automatic Reconnection**: Smart reconnection with heartbeat monitoring and connection quality assessment
- **Connection State Management**: Persistent connection state with localStorage integration
- **Health Monitoring**: Real-time connection health metrics and latency tracking
- **Error Recovery**: Comprehensive error handling with user-friendly feedback
- Fixed Socket.io integration between frontend and backend
- Resolved TypeScript compatibility issues with Socket.io types
- Improved error handling for real-time message processing
- Enhanced voice input integration architecture

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm run test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## 📚 Documentation

- [Usage Guide](USAGE.md) - Detailed user guide
- [Deployment Guide](DEPLOYMENT.md) - Production deployment
- [Environment Setup](ENV_SETUP.md) - Environment configuration
- [GitHub Setup](GITHUB_SETUP.md) - Repository setup guide

## 🐛 Troubleshooting

### Common Issues

**Voice features not working?**
- Ensure you're using HTTPS (required for Web Speech API)
- Check microphone permissions
- Verify OpenAI API key is set correctly

**Connection issues?**
- Check WebSocket URL configuration
- Verify CORS settings
- Ensure both frontend and backend are running

**Performance issues?**
- Enable audio compression in settings
- Adjust TTS settings for faster response
- Monitor memory usage for long sessions

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for GPT-4, Whisper, and TTS APIs
- Web Speech API for browser-native voice features
- React and Node.js communities for excellent tooling
- All contributors and testers

---

**Ready to embark on your voice-controlled adventure?** 🎭✨

Start with `npm run dev` and let your voice guide the story!