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

### Rate Limiting & API Management

The application implements sophisticated rate limiting to ensure reliable OpenAI API usage:

#### RateLimiter Service
- **Token Bucket Algorithm**: Efficient rate limiting with configurable burst capacity
- **Request Queuing**: Priority-based queue system for handling API request bursts
- **Exponential Backoff**: Intelligent retry logic with increasing delays for failed requests
- **Multi-Endpoint Support**: Separate rate limits for different OpenAI services (GPT-4, TTS, Whisper)
- **Real-time Metrics**: Comprehensive tracking of request success rates, queue sizes, and wait times
- **Circuit Breaker Pattern**: Automatic fallback when API limits are exceeded

#### API Endpoint Configuration
- **OpenAI Chat (GPT-4)**: 60 requests/minute, burst limit of 10, queue size 50
- **OpenAI TTS**: 50 requests/minute, burst limit of 8, queue size 30  
- **OpenAI Whisper**: 50 requests/minute, burst limit of 8, queue size 30

#### Error Handling & Fallbacks
- **Graceful Degradation**: Automatic fallback to text-only mode when TTS fails
- **Request Timeout Management**: 30-60 second timeouts with proper cleanup
- **Health Monitoring**: Service availability tracking with automatic recovery
- **Fallback Responses**: Pre-defined responses when LLM services are unavailable

### Connection Management

The application features a robust connection management system with comprehensive monitoring and reliability features:

#### Frontend Connection Manager
- **Automatic Reconnection**: Exponential backoff retry logic with configurable parameters
- **Health Monitoring**: Real-time connection quality assessment based on latency
- **State Persistence**: Connection state saved to localStorage for recovery across page reloads
- **Heartbeat System**: Regular ping/pong monitoring to detect connection issues
- **Event-Driven Architecture**: Clean separation of concerns with event listeners

#### Backend Connection Monitoring
- **Advanced Connection Tracking**: Detailed connection info with health metrics and quality assessment
- **Timeout Management**: Automatic detection and handling of inactive connections
- **Error Tracking**: Comprehensive error counting and classification per connection
- **Session Persistence**: Automatic session recovery across server restarts
- **Graceful Shutdown**: Proper cleanup with client notification and session preservation

#### Connection States
- `connecting` - Initial connection attempt
- `connected` - Successfully connected with heartbeat active
- `disconnected` - Connection lost, attempting reconnection
- `reconnecting` - Actively trying to reconnect with backoff delay
- `failed` - Max reconnection attempts exceeded

#### Connection Quality Metrics
- `excellent` - Low latency, no errors, active communication
- `good` - Moderate latency, minimal errors
- `poor` - High latency or some errors detected
- `critical` - Very high latency, frequent errors, or connection timeouts

#### Server Monitoring Features
- **Real-time Health Checks**: Periodic connection health assessment every 30 seconds
- **Connection Quality Scoring**: Dynamic quality assessment based on latency, errors, and activity
- **Automatic Cleanup**: Removal of stale connections with session preservation
- **Performance Metrics**: Tracking of connection duration, error rates, and server uptime
- **Timeout Detection**: Proactive identification of unresponsive connections

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
- **Enhanced Socket.io** WebSocket server with advanced connection monitoring
- **OpenAI API** integration (GPT-4, Whisper, TTS) with intelligent rate limiting
- **Advanced Rate Limiting**: Token bucket algorithm with request queuing and priority handling
- **Multer** for audio file handling
- **Comprehensive error handling** and fallback mechanisms
- **Advanced Connection Management**: Real-time health monitoring, timeout detection, and quality assessment
- **Session Persistence**: Automatic session recovery across server restarts and connection drops
- **Graceful Shutdown**: Proper cleanup procedures with client notification
- **Performance Monitoring**: Connection metrics, error tracking, and server health statistics
- **Robust Testing Suite**: Comprehensive test coverage for all services with proper mocking and error simulation

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
│   │   ├── 📁 services/      # Business logic & AI integrations
│   │   │   ├── RateLimiter.ts    # Token bucket rate limiting
│   │   │   ├── OpenAILLM.ts      # GPT-4 integration with rate limiting
│   │   │   ├── OpenAITTS.ts      # TTS with fallback handling
│   │   │   └── WebSocketServer.ts # Enhanced connection management
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

# Rate Limiting Configuration (optional - defaults provided)
RATE_LIMIT_CHAT_RPM=60
RATE_LIMIT_TTS_RPM=50
RATE_LIMIT_WHISPER_RPM=50
RATE_LIMIT_BURST_MULTIPLIER=0.2
```

#### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
VITE_ENABLE_VOICE_FEATURES=true
```

## 🧪 Testing

The project includes comprehensive testing with accessibility compliance and robust backend service validation:

- **Unit Tests**: Component and service testing with Vitest
- **Accessibility Tests**: ARIA labels, keyboard navigation, and screen reader support
- **Integration Tests**: API and WebSocket testing with enhanced mocking
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
- **WebSocket Testing**: Real-time communication reliability with proper Socket.io mocking
- **Error Handling Testing**: Graceful degradation scenarios
- **Component Integration Testing**: ChatInterface and voice input coordination
- **Rate Limiting Testing**: Token bucket algorithm and queue management validation
- **API Integration Testing**: OpenAI service reliability with retry logic and proper error simulation
- **TypeScript Compliance Testing**: Strict type checking and modern React patterns

### Backend Service Testing
- **OpenAI Service Tests**: Comprehensive testing of LLM, TTS, and Whisper ASR services with proper mocking
- **Rate Limiter Tests**: Token bucket algorithm, request queuing, priority handling, and metrics tracking
- **WebSocket Server Tests**: Connection management, message processing, and LLM integration with optimized test performance
- **Error Recovery Tests**: Fallback mechanisms, timeout handling, and service degradation
- **Health Check Tests**: Service availability monitoring and automatic recovery validation

### Rate Limiting Monitoring

The RateLimiter service provides comprehensive metrics for monitoring API usage:

```typescript
// Get metrics for a specific endpoint
const metrics = globalRateLimiter.getMetrics('openai-chat');
console.log({
  totalRequests: metrics.totalRequests,
  successfulRequests: metrics.successfulRequests,
  rateLimitedRequests: metrics.rateLimitedRequests,
  queuedRequests: metrics.queuedRequests,
  averageWaitTime: metrics.averageWaitTime,
  currentTokens: metrics.currentTokens
});

// Get current queue status
const queueStatus = globalRateLimiter.getQueueStatus();
console.log('Queue status:', queueStatus);
```

#### Rate Limiting Events
The RateLimiter emits events for monitoring:
- `requestQueued`: When a request is added to the queue
- `requestProcessed`: When a queued request is processed
- `rateLimitExceeded`: When rate limits are hit

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

✅ **Enhanced Reliability & Testing**
- **Backend Service Stability**: All critical OpenAI API integrations (LLM, TTS, Whisper) with robust error handling and retry logic
- **Advanced Rate Limiting**: Token bucket algorithm with request queuing and priority management for API calls
- **Connection Management**: Enhanced WebSocket server with health monitoring, timeout detection, and automatic reconnection
- **Comprehensive Test Suite**: Full test coverage for all backend services with proper mocking and error simulation
- **Service Health Monitoring**: Real-time health checks and performance metrics for all AI services
- **Graceful Degradation**: Automatic fallback mechanisms when services are unavailable or rate-limited

## 🔧 Development Progress

### ✅ Completed (Phase 1-3)
- **WebSocket Connection Reliability**: Enhanced connection manager with exponential backoff and heartbeat monitoring
- **OpenAI API Integration**: Complete LLM, TTS, and Whisper services with rate limiting and retry logic
- **Backend Test Suite**: Comprehensive testing for all services with proper mocking and error scenarios
- **Rate Limiting System**: Token bucket algorithm with request queuing and priority handling
- **Error Handling**: Robust error classification, fallback mechanisms, and user-friendly error messages

### 🚧 In Progress (Phase 4-5)
- **Frontend Test Fixes**: Resolving remaining component test issues and improving mock setups
- **Enhanced Error Handling**: Centralized error management with recovery suggestions
- **UI/UX Improvements**: Better status indicators and loading states

### 📋 Planned (Phase 6-12)
- **Performance Optimization**: Session cleanup, request caching, and audio processing improvements
- **Monitoring & Logging**: Structured logging system and performance metrics collection
- **Code Quality**: Architecture refactoring and TypeScript improvements
- **Final Testing**: End-to-end testing and quality assurance

✅ **Recent Improvements**
- **Advanced Rate Limiting System**: New RateLimiter service with token bucket algorithm, request queuing, and priority handling for OpenAI API calls
- **Enhanced Connection Reliability**: New ConnectionManager service with exponential backoff retry logic
- **Advanced Server Monitoring**: Comprehensive connection tracking with health metrics, error counting, and quality assessment
- **Intelligent API Management**: Separate rate limits for GPT-4, TTS, and Whisper with automatic fallback mechanisms
- **Request Queue Management**: Priority-based queuing system with timeout handling and metrics tracking
- **Automatic Reconnection**: Smart reconnection with heartbeat monitoring and connection quality assessment
- **Connection State Management**: Persistent connection state with localStorage integration and server-side session recovery
- **Health Monitoring**: Real-time connection health metrics, latency tracking, and timeout detection
- **Graceful Shutdown Handling**: Proper server shutdown with client notification and session preservation
- **Error Recovery**: Comprehensive error handling with user-friendly feedback and automatic cleanup
- **Performance Metrics**: Server uptime tracking, connection statistics, and quality distribution monitoring
- **Circuit Breaker Pattern**: Automatic service degradation when API limits are exceeded
- **Enhanced Test Coverage**: Improved WebSocket integration tests with proper LLM service mocking and TTS integration validation
- **Service Reliability**: Comprehensive error handling tests for OpenAI services with retry logic and fallback mechanisms
- **Connection Management Tests**: Advanced WebSocket server testing with connection monitoring and session persistence
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
- Monitor connection quality indicators in the UI
- Check browser console for connection timeout warnings
- Verify server health with automatic reconnection attempts

**API rate limiting issues?**
- Monitor rate limit metrics in server logs
- Check OpenAI API key validity and quota
- Verify rate limiter configuration for your usage patterns
- Review queue status if requests are being delayed
- Consider upgrading OpenAI plan for higher rate limits

**Performance issues?**
- Enable audio compression in settings
- Adjust TTS settings for faster response
- Monitor memory usage for long sessions
- Check rate limiter metrics for API bottlenecks
- Review request queue sizes during peak usage

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