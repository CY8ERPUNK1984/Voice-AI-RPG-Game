# Voice AI RPG Game

🎮 An interactive voice-controlled role-playing game that combines AI-powered storytelling with real-time voice interaction.

## ⚠️ PROJECT STATUS: NOT WORKING - REQUIRES DEBUGGING

**This project is currently in a non-functional state and requires debugging and fixes before it can be used.**

### Known Issues:
- Voice recognition and TTS integration may not work properly
- WebSocket connections may be unstable
- AI service integrations need configuration and testing
- Some components may have runtime errors
- Environment setup and API keys need proper configuration

### Development Status:
- ✅ Basic project structure is complete
- ✅ Frontend and backend scaffolding is in place
- ✅ TypeScript configuration and build system working
- ❌ Voice features need debugging and testing
- ❌ AI service integrations require fixes
- ❌ End-to-end functionality needs validation
- ❌ Production deployment not ready

**Please expect to spend time debugging and fixing issues before the application will work as intended.**

## ✨ Features

- **🎙️ Voice-Controlled Gameplay**: Use speech-to-text (ASR) for natural game interaction
- **🤖 AI Game Master**: Powered by OpenAI GPT-4 for intelligent, contextual responses
- **🔊 Immersive Audio**: Text-to-speech output with customizable voice settings
- **📚 Multiple Stories**: Choose from fantasy, sci-fi, mystery, adventure, and horror scenarios
- **⚡ Real-time Communication**: WebSocket-based instant responses
- **🎛️ Customizable Settings**: Adjust audio, voice speed, and sensitivity
- **🌐 Cross-Platform**: Works on desktop and mobile browsers
- **♿ Accessibility**: Full keyboard navigation, screen reader support, and ARIA labels
- **🌙 Dark Theme UI**: Modern dark interface optimized for immersive gaming experience

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
- **Session Persistence**: Automatic session recovery across server restarts with file-based persistence
- **Graceful Shutdown**: Proper cleanup with client notification and session preservation
- **Session Health Monitoring**: Real-time health assessment with memory usage and activity tracking
- **Performance Metrics**: Comprehensive session metrics including duration, message counts, and resource usage

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
- **Session Metrics Tracking**: Comprehensive monitoring of active sessions, memory usage, and message counts
- **Health Assessment**: Individual session health monitoring with automatic cleanup of unhealthy sessions
- **Persistence Layer**: File-based session persistence for recovery across server restarts

### Frontend (React + TypeScript)
- **React 18** with modern hooks and concurrent features
- **Vite** for lightning-fast development and builds
- **Tailwind CSS** for responsive, utility-first styling with dark theme implementation
- **React Context API** for centralized application state management with AppContext
- **Zustand** for lightweight component-level state management
- **Socket.io Client** with enhanced ConnectionManager for reliable real-time communication
- **Web Speech API** + **OpenAI Whisper** for voice input with optimized audio quality settings
- **Web Speech API** + **OpenAI TTS** for voice output
- **Modern React patterns** with proper event handling and state management
- **Robust connection management** with automatic reconnection and health monitoring
- **Enhanced UI components** with progress indicators, loading states, and real-time feedback
- **Story Selection Interface** with genre filtering, search functionality, and immersive dark theme

### Backend (Node.js + TypeScript)
- **Express** server with TypeScript
- **Enhanced Socket.io** WebSocket server with advanced connection monitoring
- **OpenAI API** integration (GPT-4, Whisper, TTS) with intelligent rate limiting
- **Advanced Rate Limiting**: Token bucket algorithm with request queuing and priority handling
- **Multer** for audio file handling
- **Comprehensive error handling** and fallback mechanisms
- **Advanced Connection Management**: Real-time health monitoring, timeout detection, and quality assessment
- **Session Persistence**: File-based session persistence for automatic recovery across server restarts and connection drops
- **Session Health Monitoring**: Real-time session metrics tracking with memory usage and activity monitoring
- **Structured Logging System**: Multi-level logging with request tracking, performance metrics, and automatic log rotation
- **Graceful Shutdown**: Proper cleanup procedures with client notification
- **Performance Monitoring**: Prometheus-style metrics collection with counters, gauges, and histograms
- **Alert System**: Configurable threshold-based alerting with real-time notifications
- **Resource Monitoring**: Automatic CPU, memory, and system resource tracking
- **Robust Testing Suite**: Comprehensive test coverage for all services with proper mocking and error simulation

### Performance Monitoring and Metrics System

The application features a comprehensive performance monitoring system built on modern observability principles:

#### PerformanceMonitor Service
- **Prometheus-style Metrics**: Counter, gauge, and histogram metrics with label support
- **Real-time Collection**: Automatic system resource monitoring (CPU, memory, network)
- **Event-driven Architecture**: EventEmitter-based alert system with configurable rules
- **Singleton Pattern**: Global performance monitor instance with proper lifecycle management
- **Automatic Cleanup**: Time-based metric retention and memory management

#### Metric Types & Usage
```typescript
// Counter metrics (monotonically increasing)
monitor.incrementCounter('requests_total', 1, { method: 'GET', status: '200' });

// Gauge metrics (can go up or down)
monitor.setGauge('cpu_usage_percent', 75.5);

// Histogram metrics (for response times, percentiles)
monitor.recordHistogram('response_time_ms', 150, { service: 'api' });

// Timer utilities for measuring durations
const endTimer = monitor.startTimer('operation_duration');
// ... perform operation
const duration = endTimer();

// Async operation timing with error tracking
const result = await monitor.timeAsync('async_operation', async () => {
  return await someAsyncOperation();
});
```

#### Service Metrics & Health Monitoring
- **Service Performance Tracking**: Response times, throughput, error rates, and availability
- **Automatic Health Assessment**: Real-time service health evaluation based on metrics
- **Resource Monitoring**: System CPU, memory, disk, and network usage tracking
- **Performance Summaries**: Statistical analysis with percentiles (p50, p95, p99)

#### Alert System
- **Configurable Alert Rules**: Threshold-based alerting with multiple condition types
- **Real-time Notifications**: Event-driven alert firing and resolution
- **Alert Management**: Add, remove, and configure alert rules dynamically
- **Status Tracking**: Active alert monitoring with automatic resolution

```typescript
// Add alert rule
const rule: AlertRule = {
  id: 'high_cpu',
  name: 'High CPU Usage',
  metric: 'cpu_usage_percent',
  condition: 'gt',
  threshold: 80,
  duration: 60,
  enabled: true
};
monitor.addAlertRule(rule);

// Listen for alerts
monitor.on('alert', (alert: Alert) => {
  console.log(`Alert fired: ${alert.message}`);
});
```

#### Monitoring Dashboard Integration
- **Real-time Dashboard**: React-based monitoring interface with auto-refresh
- **System Overview**: Service status, resource usage, and alert summaries
- **Visual Indicators**: Color-coded status indicators and progress bars
- **Historical Data**: Metric trends and performance analytics

### Structured Logging System

The application features a comprehensive structured logging system designed for production monitoring and debugging:

#### Logger Features
- **Multi-Level Logging**: Support for debug, info, warn, error, and fatal log levels
- **Structured JSON Output**: Consistent log format with contextual information and metadata
- **Request Tracking**: Automatic request ID correlation across service calls
- **Performance Monitoring**: Built-in duration tracking and memory usage reporting
- **File Management**: Automatic log rotation, cleanup, and configurable file size limits
- **Buffer Management**: Efficient log buffering with periodic flushing to prevent I/O blocking
- **Graceful Shutdown**: Proper log flushing and cleanup on application termination

#### Log Entry Structure
```typescript
interface LogEntry {
  id: string;                    // Unique log entry identifier
  timestamp: string;             // ISO timestamp
  level: LogLevel;               // Log severity level
  service: string;               // Service name (e.g., 'voice-ai-rpg')
  component: string;             // Component/module name
  message: string;               // Human-readable message
  error?: {                      // Error details (if applicable)
    name: string;
    message: string;
    stack?: string;
  };
  context: Record<string, any>;  // Additional contextual data
  userId?: string;               // User identifier
  sessionId?: string;            // Game session identifier
  requestId?: string;            // Request correlation ID
  duration?: number;             // Operation duration (ms)
  memoryUsage?: NodeJS.MemoryUsage; // Memory usage snapshot
}
```

#### Logger Configuration
```typescript
interface LoggerConfig {
  level: LogLevel;               // Minimum log level to output
  service: string;               // Service identifier
  logFile?: string;              // Log file name (optional)
  maxFileSize?: number;          // Max file size before rotation (bytes)
  maxFiles?: number;             // Number of rotated files to keep
  enableConsole?: boolean;       // Enable console output
  enableFile?: boolean;          // Enable file output
  enableStructured?: boolean;    // Enable structured JSON logging
}
```

#### Usage Examples
```typescript
import { createLogger, getLogger } from '@/services/Logger';

// Initialize logger (typically in main application file)
const logger = createLogger({
  level: 'info',
  service: 'voice-ai-rpg',
  logFile: 'app.log',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5
});

// Use logger throughout the application
const logger = getLogger();

// Basic logging
logger.info('User started new game session', { userId: 'user123' });
logger.error('OpenAI API request failed', error, { endpoint: '/chat' });

// Performance logging
logger.logPerformance('LLM Response Generation', 1250, { 
  model: 'gpt-4', 
  tokens: 150 
});

// Request logging (automatic in middleware)
logger.logRequest('POST', '/api/game/action', 200, 850, { 
  sessionId: 'session456' 
});

// Business event logging
logger.logEvent('story_selected', { 
  storyId: 'fantasy-adventure', 
  userId: 'user123' 
});

// Request context tracking
logger.setRequestId('req-789');
logger.info('Processing user action'); // Automatically includes request ID
logger.clearRequestId();
```

#### Log Management Features
- **Automatic Rotation**: Files rotate when they exceed the configured size limit
- **Cleanup**: Old log files are automatically removed based on retention policy
- **Search Functionality**: Built-in log search capabilities for debugging
- **Buffer Flushing**: Logs are buffered and flushed periodically for performance
- **Graceful Shutdown**: Ensures all logs are written before application termination

#### Monitoring and Metrics
```typescript
// Get logger statistics
const stats = logger.getStats();
console.log({
  bufferSize: stats.bufferSize,
  memoryUsage: stats.memoryUsage
});

// Search logs for debugging
const errorLogs = await logger.searchLogs('OpenAI API', 'error', 50);
console.log('Recent API errors:', errorLogs);
```

#### Log File Structure
- **Primary Log**: `logs/app.log` - Current active log file
- **Rotated Logs**: `logs/app.log.1`, `logs/app.log.2`, etc. - Historical log files
- **JSON Format**: Each line is a complete JSON object for easy parsing and analysis
- **Automatic Cleanup**: Old files are removed based on `maxFiles` configuration

### State Management

The application uses a hybrid approach to state management for optimal performance and developer experience:

#### AppContext (Global State)
Centralized React Context API implementation for application-wide state management:

```typescript
interface AppContextState {
  currentStory: Story | null;        // Currently selected story
  gameSession: GameSession | null;   // Active game session
  isConnected: boolean;              // WebSocket connection status
  stories: Story[];                  // Available story scenarios
  storiesLoading: boolean;           // Stories loading state
  offlineMode: boolean;              // Offline mode indicator
}
```

**Key Features:**
- **Reducer Pattern**: Predictable state updates with typed actions
- **Convenience Methods**: Simple API for common state operations
- **Connection Awareness**: Real-time connection status tracking
- **Offline Support**: Automatic offline mode detection
- **Type Safety**: Full TypeScript support with strict typing

**Usage Example:**
```typescript
import { useApp } from '@/contexts/AppContext';

function GameComponent() {
  const { state, setCurrentStory, setConnectionStatus } = useApp();
  
  // Access global state
  const { currentStory, isConnected, offlineMode } = state;
  
  // Update state
  const handleStorySelect = (story: Story) => {
    setCurrentStory(story);
  };
}
```

#### Component-Level State (Zustand)
Lightweight state management for component-specific state that doesn't need global access.

### AI Services Integration
- **ASR**: Web Speech API + OpenAI Whisper with advanced audio optimization
  - **Audio Preprocessing Pipeline**: Compression, silence trimming, noise reduction, and volume normalization
  - **Intelligent Audio Analysis**: Duration validation, format detection, and quality assessment
  - **Buffer Pool Management**: Efficient memory usage with reusable audio buffers
  - **Chunked Processing**: Support for large audio files with automatic chunking
  - Echo cancellation, noise suppression, and auto gain control
  - Optimized 16kHz sample rate for speech recognition
- **LLM**: OpenAI GPT-4 for game master responses
- **TTS**: Web Speech API (primary) + OpenAI TTS (premium)

### Audio Optimization System

The WhisperASR service includes a comprehensive audio optimization pipeline designed to improve transcription accuracy and reduce API costs:

#### Audio Preprocessing Features
- **Compression**: Intelligent audio compression with configurable target bitrate (default: 64 kbps for speech)
- **Silence Trimming**: Automatic removal of silence from beginning and end of audio recordings
- **Noise Reduction**: Optional noise reduction processing for cleaner audio input
- **Volume Normalization**: Automatic volume level adjustment for consistent audio processing
- **Duration Limits**: Configurable maximum audio duration (default: 5 minutes)
- **Format Validation**: Audio format detection and validation before processing

#### Performance Optimizations
- **Buffer Pool Management**: Reusable audio buffer pool to reduce memory allocation overhead with configurable pool size
- **Chunked Processing**: Support for large audio files with automatic chunking for files exceeding size limits
- **Audio Analysis**: Real-time audio metadata extraction including duration, sample rate, and format detection
- **Compression Metrics**: Detailed compression statistics and processing time tracking
- **Service Statistics**: Comprehensive stats tracking including buffer pool usage, health status, and configuration settings
- **Maintenance Operations**: Automatic buffer cleanup and health status recovery with detailed reporting

#### Configuration Options
```typescript
// Audio optimization settings
const audioOptimization = {
  enableCompression: true,        // Enable audio compression
  targetBitrate: 64,             // Target bitrate in kbps
  maxDuration: 300,              // Maximum duration in seconds
  enableSilenceTrimming: true,   // Remove silence from audio
  enableNoiseReduction: false,  // Apply noise reduction (requires additional libraries)
  enableVolumeNormalization: false // Normalize audio volume levels
};

// Configure WhisperASR with optimization settings
whisperASR.configureAudioOptimization(audioOptimization);

// Get current optimization settings
const currentSettings = whisperASR.getAudioOptimizationSettings();

// Get service statistics
const stats = whisperASR.getStats();
console.log({
  model: stats.model,
  healthStatus: stats.healthStatus,
  bufferPoolSize: stats.bufferPoolSize,
  audioOptimization: stats.audioOptimization
});

// Perform maintenance operations
const maintenanceResult = await whisperASR.performMaintenance();
console.log(`Cleared ${maintenanceResult.buffersCleared} buffers`);
```

## 📁 Project Structure

```
voice-ai-rpg-game/
├── 📁 frontend/              # React application
│   ├── 📁 src/
│   │   ├── 📁 components/    # React components
│   │   │   ├── StorySelector.tsx     # Enhanced story selection with dark theme
│   │   │   ├── ChatInterface.tsx     # Voice-enabled chat interface
│   │   │   ├── VoiceInput.tsx        # Voice recording component
│   │   │   ├── AudioPlayer.tsx       # TTS audio playback
│   │   │   └── __tests__/            # Component tests
│   │   ├── 📁 contexts/      # React Context providers (AppContext)
│   │   ├── 📁 services/      # API clients & integrations
│   │   ├── 📁 types/         # TypeScript definitions
│   │   ├── 📁 data/          # Story data (stories.json)
│   │   └── 📁 utils/         # Utility functions
│   └── 📁 dist/             # Built frontend
├── 📁 backend/               # Node.js server
│   ├── 📁 src/
│   │   ├── 📁 controllers/   # Route handlers
│   │   ├── 📁 services/      # Business logic & AI integrations
│   │   │   ├── RateLimiter.ts        # Token bucket rate limiting
│   │   │   ├── OpenAILLM.ts          # GPT-4 integration with rate limiting
│   │   │   ├── OpenAITTS.ts          # TTS with fallback handling
│   │   │   ├── WebSocketServer.ts    # Enhanced connection management
│   │   │   ├── GameSessionManager.ts # Session management with health monitoring
│   │   │   ├── Logger.ts             # Structured logging with rotation and metrics
│   │   │   └── PerformanceMonitor.ts # Prometheus-style metrics and alerting system
│   │   ├── 📁 data/          # Story data
│   │   └── 📁 types/         # TypeScript definitions
│   └── 📁 dist/             # Built backend
├── 📁 e2e/                  # End-to-end tests
├── 📁 logs/                 # Application logs (auto-generated)
├── 📁 .kiro/specs/          # Project specifications
└── 📄 Documentation files
```

## 🎮 How to Play

1. **Choose Your Adventure**: Select from available story scenarios using the enhanced story selector
2. **Voice Interaction**: Click the microphone and speak your actions
3. **AI Responses**: The AI game master responds with voice and text
4. **Customize Experience**: Adjust audio settings to your preference
5. **Explore & Enjoy**: Use natural language to interact with the game world

### Story Selection Interface

The StorySelector component provides an intuitive way to browse and select game scenarios:

- **🔍 Search Functionality**: Find stories by title or description
- **🏷️ Genre Filtering**: Filter by fantasy, sci-fi, mystery, adventure, or horror
- **🌙 Dark Theme**: Immersive dark interface optimized for gaming
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices
- **⚡ Real-time Filtering**: Instant search results and genre filtering
- **📊 Story Counter**: Shows filtered results count for better navigation

#### Available Story Genres
- **Fantasy** (Фэнтези): Magical worlds with dragons, wizards, and ancient mysteries
- **Sci-Fi** (Научная фантастика): Futuristic space stations and technological challenges  
- **Mystery** (Детектив): Detective stories with puzzles and hidden clues
- **Adventure** (Приключения): Pirate adventures and treasure hunting
- **Horror** (Хоррор): Psychological thriller experiences in abandoned locations

### Application State Management

The app uses centralized state management through React Context API:

```typescript
// Wrap your app with AppProvider
import { AppProvider } from '@/contexts/AppContext';

function App() {
  return (
    <AppProvider>
      <YourAppComponents />
    </AppProvider>
  );
}

// Use the context in components
import { useApp } from '@/contexts/AppContext';

function GameComponent() {
  const { state, setCurrentStory, setConnectionStatus } = useApp();
  
  // Access current story, connection status, etc.
  const { currentStory, isConnected, offlineMode } = state;
}
```

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

# Logging Configuration (optional - defaults provided)
LOG_LEVEL=info
LOG_FILE=app.log
LOG_MAX_FILE_SIZE=10485760
LOG_MAX_FILES=5
LOG_ENABLE_CONSOLE=true
LOG_ENABLE_FILE=true
```

#### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
VITE_ENABLE_VOICE_FEATURES=true
```

## 📊 Monitoring API

The application provides comprehensive monitoring endpoints for system health and performance metrics:

### Health Check Endpoints
```bash
GET /api/health              # System health overview
GET /api/health/detailed     # Detailed health information
```

### Monitoring Dashboard Endpoints
```bash
GET /api/monitoring/dashboard    # Dashboard overview data
GET /api/monitoring/metrics      # All performance metrics
GET /api/monitoring/alerts       # Active alerts
GET /api/monitoring/services     # Service health status
```

### Metrics Collection
The PerformanceMonitor automatically collects:
- **System Metrics**: CPU usage, memory consumption, load averages
- **Service Metrics**: Response times, throughput, error rates, availability
- **Application Metrics**: Request counts, session metrics, connection health
- **Custom Metrics**: Business-specific counters, gauges, and histograms

### Alert Configuration
```typescript
// Example alert rule configuration
const alertRule = {
  id: 'high_memory_usage',
  name: 'High Memory Usage',
  metric: 'system_memory_usage_percent',
  condition: 'gt',
  threshold: 85,
  duration: 300, // 5 minutes
  enabled: true
};
```

## 🆕 Recent Updates

### UI/UX Improvements
- **Dark Theme Implementation**: StorySelector component now features a modern dark theme for better immersion
- **Enhanced Visual Hierarchy**: Improved contrast and readability with gray-800 backgrounds and white text
- **Interactive Elements**: Hover effects and border transitions for better user feedback
- **Genre Badge Styling**: Color-coded genre badges with improved visibility in dark theme
- **Responsive Grid Layout**: Optimized story card layout for different screen sizes

### Component Enhancements
- **StorySelector Component**: 
  - Migrated to dark theme with proper color contrast
  - Fixed TypeScript readonly array compatibility
  - Enhanced accessibility with proper ARIA labels
  - Improved loading states with skeleton loaders
  - Real-time search and filtering functionality

### Technical Improvements
- **Type Safety**: Enhanced TypeScript strict typing for readonly arrays
- **Performance**: Optimized component re-rendering with proper state management
- **Code Quality**: Improved component structure and maintainability

## 🧪 Testing

The project includes comprehensive testing with accessibility compliance and robust backend service validation:

- **Unit Tests**: Component and service testing with Vitest
- **Accessibility Tests**: ARIA labels, keyboard navigation, and screen reader support
- **Integration Tests**: API and WebSocket testing with enhanced mocking
- **E2E Tests**: Full user journey testing with Playwright
- **Performance Tests**: Audio pipeline optimization tests

```bash
# Run specific test suites
npm run test:frontend    # Frontend unit tests (✅ All major tests passing)
npm run test:backend     # Backend unit tests (✅ All tests passing)
npm run test:e2e         # End-to-end tests
```

### Testing Features
- **Loading State Testing**: Proper ARIA labeling for loading indicators
- **Voice Component Testing**: ASR and TTS functionality validation with enhanced cleanup verification
- **WebSocket Testing**: Real-time communication reliability with proper Socket.io mocking
- **Error Handling Testing**: Graceful degradation scenarios
- **Component Integration Testing**: ChatInterface and voice input coordination
- **Rate Limiting Testing**: Token bucket algorithm and queue management validation
- **API Integration Testing**: OpenAI service reliability with retry logic and proper error simulation
- **TypeScript Compliance Testing**: Strict type checking and modern React patterns
- **Event Listener Management**: Comprehensive testing of component lifecycle and cleanup procedures
- **Toast Notification Testing**: Complete timer cleanup, lifecycle management, and accessibility testing
- **Multi-Toast Management**: Testing of multiple simultaneous toasts with different durations and priorities
- **Component Styling Testing**: Comprehensive validation of toast styling for all notification types (error, warning, success, info)
- **Icon and Accessibility Testing**: Proper icon rendering and ARIA compliance for screen readers
- **Web Speech API Testing**: Enhanced browser compatibility testing with proper mock management and cleanup
- **Service Availability Testing**: Comprehensive feature detection and fallback mechanism validation
- **TTS Error Recovery Testing**: Robust error handling and service resilience testing for voice synthesis
- **Mock Lifecycle Management**: Proper setup and teardown of browser API mocks with original value restoration
- **Cross-Browser Compatibility Testing**: Validation of service behavior across different browser environments
- **Concurrent Request Testing**: Handling of multiple simultaneous TTS requests with proper cancellation

### Backend Service Testing
- **OpenAI Service Tests**: Comprehensive testing of LLM, TTS, and Whisper ASR services with proper mocking and error simulation
- **Audio Optimization Testing**: Complete validation of WhisperASR audio preprocessing pipeline including compression, silence trimming, and buffer pool management
- **Rate Limiter Tests**: Token bucket algorithm, request queuing, priority handling, and metrics tracking validation
- **WebSocket Server Tests**: Connection management, message processing, and LLM integration with proper TypeScript interfaces
- **Integration Tests**: WebSocketLLMIntegration tests with complete message flow validation and context management
- **Error Recovery Tests**: Fallback mechanisms, timeout handling, and service degradation scenarios
- **Health Check Tests**: Service availability monitoring and automatic recovery validation
- **Performance Monitor Tests**: Comprehensive testing of metrics collection, alert system, and resource monitoring
- **Singleton Pattern Tests**: Proper instance management and lifecycle testing for monitoring services
- **TypeScript Compliance**: All test files now have proper type definitions and interface implementations

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
- Centralized application state management with React Context API
- Comprehensive error handling and fallback mechanisms
- Audio settings with persistent storage
- Enhanced loading states and progress indicators
- Real-time user feedback and status updates
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

### ✅ Completed (Phase 1-4)
- **WebSocket Connection Reliability**: Enhanced connection manager with exponential backoff and heartbeat monitoring
- **OpenAI API Integration**: Complete LLM, TTS, and Whisper services with rate limiting and retry logic
- **Backend Test Suite**: All backend tests now passing with comprehensive service testing and proper mocking
- **Frontend Test Suite**: All major frontend component tests now passing with proper cleanup and error handling
- **Rate Limiting System**: Token bucket algorithm with request queuing and priority handling
- **Error Handling**: Robust error classification, fallback mechanisms, and user-friendly error messages
- **Integration Testing**: WebSocket LLM integration tests with proper TypeScript interfaces and service mocking
- **Service Health Monitoring**: Real-time health checks and performance metrics for all AI services
- **Component Testing**: Comprehensive test coverage for ToastNotification, AudioPlayer, and other critical UI components
- **Timer and Lifecycle Management**: Proper cleanup testing for all timer-based components and event listeners

### ✅ Recently Completed (Phase 4-5)
- **Frontend Test Suite Fixes**: All major frontend component tests now passing with proper cleanup and error handling
- **ToastNotification Test Enhancement**: Comprehensive test coverage with timer cleanup, lifecycle management, and accessibility testing
- **AudioPlayer Test Improvements**: Enhanced test cleanup verification with specific event listener assertions
- **Component Integration**: VoiceInput and ASR service tests fixed with proper mocking and error simulation
- **WebSpeechTTS Test Completion**: Enhanced browser API mocking with proper setup/teardown and cross-browser compatibility testing
- **Service Availability Testing**: Comprehensive feature detection and fallback mechanism validation with runtime health checks
- **Mock Lifecycle Management**: Proper setup and teardown of browser API mocks with original value restoration
- **Enhanced Error Handling**: Centralized error management with recovery suggestions and user-friendly Russian error messages
- **Session Management Enhancement**: Advanced session metrics, health monitoring, and persistence capabilities
- **AppContext Implementation**: Centralized React Context API for application state management with reducer pattern

### 🚧 In Progress (Phase 6)
- **Performance Optimization**: Session cleanup, request caching, and audio processing improvements
- **UI/UX Enhancements**: Advanced progress tracking and visual feedback improvements

### ✅ Recently Completed (Phase 11-12)
- **Structured Logging System**: Comprehensive logging service with multiple levels, request tracking, and file rotation
- **Performance Monitoring System**: Complete Prometheus-style metrics collection with counters, gauges, and histograms
- **Alert System**: Configurable threshold-based alerting with real-time event notifications
- **Resource Monitoring**: Automatic CPU, memory, and system resource tracking with health assessment
- **Monitoring Dashboard**: React-based real-time monitoring interface with auto-refresh and visual indicators
- **Metrics API**: RESTful endpoints for dashboard data, system health, and active alerts
- **Log Management**: Automatic log rotation, cleanup, and structured JSON logging with contextual information

### 📋 Planned (Phase 7-12)
- **Monitoring Dashboard**: Real-time monitoring interface and health check endpoints
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
- **Session Management Enhancement**: Advanced session metrics tracking with memory usage, message counts, and health assessment
- **Session Persistence**: File-based session persistence for automatic recovery across server restarts and connection drops
- **Resource Monitoring**: Real-time monitoring of session resource usage with automatic cleanup of unhealthy sessions
- **Circuit Breaker Pattern**: Automatic service degradation when API limits are exceeded
- **Comprehensive Test Suite**: Fixed all backend integration tests with proper mocking and error simulation
- **WebSocket Integration Tests**: Enhanced WebSocketLLMIntegration tests with proper TypeScript interfaces and service mocking
- **OpenAI Service Testing**: Complete test coverage for LLM, TTS, and Whisper services with retry logic validation
- **Rate Limiter Testing**: Comprehensive token bucket algorithm tests with priority handling and queue management
- **Service Reliability**: All OpenAI services now have robust error handling, fallback mechanisms, and health monitoring
- **TypeScript Compliance**: Fixed all TypeScript interface issues in test files and service implementations
- **Frontend Test Suite Completion**: All major frontend component tests now passing with proper cleanup and error handling
- **ToastNotification Enhancement**: Comprehensive test coverage with timer cleanup, lifecycle management, and accessibility testing
- **Multi-Toast Management**: Robust handling of multiple simultaneous notifications with different durations and priorities
- **Component Styling Validation**: Complete testing of toast styling for all notification types with proper icon rendering
- **AudioPlayer Test Improvements**: Enhanced test cleanup verification with specific event listener assertions
- **WebSpeechTTS Test Infrastructure**: Enhanced browser API mocking with proper setup/teardown, cross-browser compatibility testing, and mock lifecycle management
- **Service Resilience Testing**: Comprehensive error recovery scenarios, concurrent request handling, and runtime availability validation
- **Audio Quality Enhancement**: Updated HybridASR tests to validate enhanced audio constraints with echo cancellation, noise suppression, and optimized sample rates
- **AppContext State Management**: Implemented centralized React Context API with reducer pattern for application-wide state management
- **Structured Logging System**: Comprehensive logging service with multi-level logging, request tracking, performance metrics, and automatic file rotation
- **Log Management**: Built-in log rotation, cleanup, search functionality, and structured JSON output for production monitoring
- **Request Correlation**: Automatic request ID tracking across service calls for better debugging and monitoring
- **Performance Logging**: Built-in duration tracking and memory usage reporting for all operations
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

- **[Development Setup Guide](DEVELOPMENT.md)** - Complete setup instructions and development workflow
- **[Troubleshooting Guide](TROUBLESHOOTING.md)** - Solutions for common issues and problems
- **[API Documentation](API.md)** - REST API and WebSocket event reference
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
- Check application logs for performance bottlenecks: `tail -f logs/app.log`
- Monitor log buffer size and memory usage with logger statistics

**Logging and debugging issues?**
- Check log files in the `logs/` directory for detailed error information
- Adjust log level in environment variables for more detailed output
- Use log search functionality to find specific errors or events
- Monitor log file rotation and cleanup for disk space management
- Review structured log entries for request correlation and performance metrics

**Test failures or development issues?**
- All major backend and frontend tests are now passing
- ToastNotification component has comprehensive test coverage with timer cleanup
- AudioPlayer tests include proper event listener cleanup verification
- WebSocket integration tests use proper mocking and error simulation
- Run `npm run test` to verify all test suites are working correctly

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