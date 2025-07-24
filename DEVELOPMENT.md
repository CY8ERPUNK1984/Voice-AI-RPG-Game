# Development Setup Guide

This guide will help you set up the Voice AI RPG Game development environment on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.0.0 or higher)
- **npm** (v8.0.0 or higher)
- **Git** (for version control)

### Verify Prerequisites

```bash
node --version  # Should be v18.0.0+
npm --version   # Should be v8.0.0+
git --version   # Any recent version
```

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd voice-ai-rpg-game
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment variables**
   ```bash
   # Copy environment templates
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   
   # Edit the files and add your API keys
   # See "Environment Configuration" section below
   ```

4. **Start development servers**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## Project Structure

```
voice-ai-rpg-game/
├── frontend/          # React application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── services/      # API clients and services
│   │   ├── stores/        # Zustand state management
│   │   ├── types/         # TypeScript definitions
│   │   └── utils/         # Utility functions
│   ├── public/            # Static assets
│   └── dist/              # Build output
├── backend/           # Node.js server
│   ├── src/
│   │   ├── controllers/   # Express route handlers
│   │   ├── services/      # Business logic
│   │   ├── types/         # TypeScript definitions
│   │   └── utils/         # Utility functions
│   └── dist/              # Build output
├── scripts/           # Build and utility scripts
└── .kiro/specs/       # Project specifications
```

## Environment Configuration

### Backend Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

#### Required Variables
```bash
# OpenAI API (required for AI features)
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
```

#### Optional Variables
```bash
# Anthropic Claude API (alternative LLM)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Audio Processing
MAX_AUDIO_FILE_SIZE=25000000
AUDIO_TEMP_DIR=temp/audio

# Development Features
ENABLE_DEBUG_LOGS=true
MOCK_OPENAI_API=false  # Set to true for testing without API keys
```

### Frontend Environment Variables

Copy `frontend/.env.example` to `frontend/.env` and configure:

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001

# Feature Flags
VITE_ENABLE_VOICE_INPUT=true
VITE_ENABLE_TTS=true
VITE_ENABLE_DEBUG_MODE=false

# Audio Settings
VITE_DEFAULT_TTS_VOLUME=0.8
VITE_DEFAULT_ASR_SENSITIVITY=0.5
```

### Getting API Keys

#### OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key and add it to your `.env` file

#### Anthropic API Key (Optional)
1. Go to https://console.anthropic.com/
2. Sign in or create an account
3. Navigate to API Keys
4. Create a new key and add it to your `.env` file

## Development Commands

### Root Level Commands

```bash
# Start both frontend and backend in development mode
npm run dev

# Install all dependencies
npm run install:all

# Build both frontend and backend
npm run build

# Run all tests
npm run test

# Run linting on both projects
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run type-check

# Health check (type-check + lint + test)
npm run health-check

# Clean all build outputs and node_modules
npm run clean

# Reset project (clean + install)
npm run reset
```

### Frontend Commands

```bash
cd frontend

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Linting
npm run lint
npm run lint:fix

# Type checking
npm run type-check
```

### Backend Commands

```bash
cd backend

# Development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Linting
npm run lint
npm run lint:fix

# Type checking
npm run type-check
```

## Development Workflow

### 1. Starting Development

```bash
# Terminal 1: Start both servers
npm run dev

# Or start them separately:
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend
npm run dev:frontend
```

### 2. Making Changes

- Frontend changes will hot-reload automatically
- Backend changes will restart the server automatically
- TypeScript errors will be shown in the terminal

### 3. Testing

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run specific test suites
npm run test:frontend
npm run test:backend
```

### 4. Building

```bash
# Build everything
npm run build

# Verify build
node scripts/build-verify.js

# Test production build locally
npm run start
```

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Kill processes on ports 3000 and 3001
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

#### Node Modules Issues
```bash
# Clean and reinstall
npm run reset
```

#### TypeScript Errors
```bash
# Check types
npm run type-check

# Common fixes:
rm -rf node_modules package-lock.json
npm install
```

#### Build Failures
```bash
# Clean build
npm run clean
npm run build

# Check for missing dependencies
npm audit
npm audit fix
```

### Environment Issues

#### Missing API Keys
- Set `MOCK_OPENAI_API=true` in backend/.env for testing
- Check that .env files are not committed to git
- Verify environment variables are loaded correctly

#### CORS Issues
- Ensure FRONTEND_URL matches your frontend URL
- Check that CORS_ORIGIN is set correctly
- Verify proxy configuration in vite.config.ts

#### Audio Issues
- Check browser permissions for microphone
- Verify HTTPS is used in production for audio features
- Test with different browsers

### Performance Issues

#### Slow Development Server
```bash
# Clear caches
npm run clean:cache

# Reduce TypeScript checking
# Edit tsconfig.json: set "skipLibCheck": true
```

#### Memory Issues
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run dev
```

## Testing

### Unit Tests
- Frontend: Vitest + React Testing Library
- Backend: Vitest + Node.js testing utilities

### Running Tests
```bash
# All tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Specific test files
cd frontend && npm test -- VoiceInput.test.tsx
cd backend && npm test -- GameSessionManager.test.ts
```

### Writing Tests
- Place tests in `__tests__` directories or use `.test.ts` suffix
- Follow existing test patterns
- Mock external dependencies
- Test both success and error cases

## Code Quality

### Linting
- ESLint configuration for TypeScript
- Consistent code formatting
- Import/export rules

### Type Safety
- Strict TypeScript configuration
- Path aliases for clean imports
- Shared types between frontend/backend

### Git Hooks (Recommended)
```bash
# Install husky for git hooks
npm install --save-dev husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run health-check"
```

## Deployment

### Development Deployment
```bash
# Build and verify
npm run build
node scripts/build-verify.js

# Start production mode locally
npm run start
```

### Production Deployment
1. Set up production environment variables
2. Build the application: `npm run build`
3. Deploy backend to your server
4. Deploy frontend to CDN/static hosting
5. Configure reverse proxy (nginx/Apache)

## API Documentation

### WebSocket Events

#### Client to Server
- `join-game`: Join a game session
- `send-message`: Send text message
- `voice-input`: Send voice data
- `leave-game`: Leave current session

#### Server to Client
- `game-state`: Current game state
- `ai-response`: AI-generated response
- `error`: Error messages
- `connection-status`: Connection health

### REST API Endpoints

#### Game Management
- `POST /api/games` - Create new game
- `GET /api/games/:id` - Get game details
- `DELETE /api/games/:id` - End game

#### Audio Processing
- `POST /api/audio/transcribe` - Transcribe audio
- `POST /api/audio/synthesize` - Generate speech

#### Health Check
- `GET /api/health` - Server health status

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests: `npm run test`
5. Run linting: `npm run lint:fix`
6. Commit changes: `git commit -m "Description"`
7. Push to branch: `git push origin feature-name`
8. Create a Pull Request

## Support

If you encounter issues:

1. Check this documentation
2. Look at existing issues in the repository
3. Run the health check: `npm run health-check`
4. Check the console for error messages
5. Create a new issue with detailed information

## Additional Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Express.js Documentation](https://expressjs.com/)
- [Socket.io Documentation](https://socket.io/docs/)
- [OpenAI API Documentation](https://platform.openai.com/docs/)