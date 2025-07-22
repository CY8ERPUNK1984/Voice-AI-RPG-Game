# Deployment Guide

## Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key (for LLM and TTS features)

## Environment Setup

### Backend (.env)
```
NODE_ENV=production
PORT=3001
OPENAI_API_KEY=your_actual_openai_api_key
AUDIO_TEMP_DIR=temp/audio
MAX_AUDIO_FILE_SIZE=25000000
SESSION_CLEANUP_INTERVAL=3600000
MAX_SESSION_AGE=86400000
```

### Frontend (.env)
```
VITE_API_BASE_URL=https://your-backend-domain.com
VITE_WS_URL=wss://your-backend-domain.com
VITE_ENABLE_VOICE_FEATURES=true
```

## Installation

1. Install dependencies:
```bash
npm run install:all
```

2. Build the application:
```bash
npm run build
```

3. Start the production server:
```bash
# Start backend
cd backend && npm start

# Start frontend (serve built files)
cd frontend && npm run preview
```

## Development

1. Start development servers:
```bash
npm run dev
```

2. Run tests:
```bash
npm run test
```

3. Run E2E tests:
```bash
npm run test:e2e
```

## Features

- Voice-controlled RPG gameplay
- Real-time AI responses using OpenAI GPT
- Text-to-speech output
- Multiple story scenarios
- WebSocket real-time communication
- Fallback mechanisms for voice features

## Browser Support

- Chrome 80+ (recommended for voice features)
- Firefox 80+
- Safari 14+
- Edge 80+

## Troubleshooting

### Voice Features Not Working
- Ensure HTTPS is used (required for Web Speech API)
- Check microphone permissions
- Verify OpenAI API key is set

### Connection Issues
- Check WebSocket URL configuration
- Verify CORS settings
- Check firewall settings

### Performance Issues
- Enable audio compression
- Adjust TTS settings
- Monitor memory usage for long sessions
