#!/usr/bin/env node

// Script to fix integration issues and optimize the application

const fs = require('fs');
const path = require('path');

console.log('🔧 Starting integration fixes...');

// 1. Fix environment variables for tests
const backendEnvExample = `# Backend Environment Variables
NODE_ENV=development
PORT=3001

# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Audio Configuration
AUDIO_TEMP_DIR=temp/audio
MAX_AUDIO_FILE_SIZE=25000000

# Session Configuration
SESSION_CLEANUP_INTERVAL=3600000
MAX_SESSION_AGE=86400000
`;

const frontendEnvExample = `# Frontend Environment Variables
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_ENABLE_VOICE_FEATURES=true
`;

// Write environment examples
fs.writeFileSync('backend/.env.example', backendEnvExample);
fs.writeFileSync('frontend/.env.example', frontendEnvExample);

console.log('✅ Environment examples updated');

// 2. Create deployment documentation
const deploymentDocs = `# Deployment Guide

## Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key (for LLM and TTS features)

## Environment Setup

### Backend (.env)
\`\`\`
NODE_ENV=production
PORT=3001
OPENAI_API_KEY=your_actual_openai_api_key
AUDIO_TEMP_DIR=temp/audio
MAX_AUDIO_FILE_SIZE=25000000
SESSION_CLEANUP_INTERVAL=3600000
MAX_SESSION_AGE=86400000
\`\`\`

### Frontend (.env)
\`\`\`
VITE_API_BASE_URL=https://your-backend-domain.com
VITE_WS_URL=wss://your-backend-domain.com
VITE_ENABLE_VOICE_FEATURES=true
\`\`\`

## Installation

1. Install dependencies:
\`\`\`bash
npm run install:all
\`\`\`

2. Build the application:
\`\`\`bash
npm run build
\`\`\`

3. Start the production server:
\`\`\`bash
# Start backend
cd backend && npm start

# Start frontend (serve built files)
cd frontend && npm run preview
\`\`\`

## Development

1. Start development servers:
\`\`\`bash
npm run dev
\`\`\`

2. Run tests:
\`\`\`bash
npm run test
\`\`\`

3. Run E2E tests:
\`\`\`bash
npm run test:e2e
\`\`\`

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
`;

fs.writeFileSync('DEPLOYMENT.md', deploymentDocs);

console.log('✅ Deployment documentation created');

// 3. Create usage documentation
const usageDocs = `# Usage Guide

## Getting Started

1. **Select a Story**: Choose from available RPG scenarios (fantasy, sci-fi, mystery, etc.)

2. **Voice Interaction**: 
   - Click the microphone button to start voice input
   - Speak your action or response
   - The AI game master will respond with audio and text

3. **Text Input**: You can also type messages in the chat interface

4. **Audio Settings**: Adjust volume, speech speed, and voice preferences in the settings panel

## Voice Commands

The AI game master understands natural language. Try commands like:

- "I want to explore the forest"
- "Check my inventory"
- "Talk to the merchant"
- "Cast a fireball spell"
- "Look around"

## Settings

### Audio Settings
- **TTS Volume**: Control text-to-speech volume
- **Voice Speed**: Adjust speech rate
- **ASR Sensitivity**: Microphone sensitivity
- **Enable/Disable TTS**: Toggle voice output

### Accessibility
- Full keyboard navigation support
- Screen reader compatible
- High contrast mode available
- Adjustable text sizes

## Troubleshooting

### Voice Input Issues
1. Check microphone permissions
2. Ensure you're using HTTPS
3. Try refreshing the page
4. Check browser compatibility

### Audio Output Issues
1. Check system volume
2. Verify TTS is enabled in settings
3. Try different voice settings
4. Check browser audio permissions

### Connection Issues
1. Check internet connection
2. Refresh the page
3. Clear browser cache
4. Try a different browser

## Tips for Best Experience

1. **Speak Clearly**: Use clear, natural speech
2. **Wait for Response**: Allow the AI to finish before speaking again
3. **Use Descriptive Language**: The more detail, the better the AI response
4. **Save Progress**: Sessions are automatically saved
5. **Experiment**: Try different approaches and commands

## Advanced Features

### Custom Stories
- Stories can be customized by modifying the JSON files
- Each story has configurable prompts and context

### API Integration
- RESTful API available for custom integrations
- WebSocket events for real-time features
- Extensible service architecture

### Performance Optimization
- Audio compression for faster loading
- Debounced voice input
- Efficient memory management
- Automatic session cleanup
`;

fs.writeFileSync('USAGE.md', usageDocs);

console.log('✅ Usage documentation created');

// 4. Update package.json scripts for better integration
const rootPackageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

rootPackageJson.scripts = {
  ...rootPackageJson.scripts,
  "start": "npm run build && concurrently \"npm run start:backend\" \"npm run start:frontend\"",
  "start:backend": "cd backend && npm start",
  "start:frontend": "cd frontend && npm run preview",
  "lint": "npm run lint:frontend && npm run lint:backend",
  "lint:frontend": "cd frontend && npm run lint",
  "lint:backend": "cd backend && npm run lint",
  "clean": "rm -rf frontend/dist backend/dist node_modules frontend/node_modules backend/node_modules",
  "reset": "npm run clean && npm run install:all"
};

fs.writeFileSync('package.json', JSON.stringify(rootPackageJson, null, 2));

console.log('✅ Package.json scripts updated');

console.log('🎉 Integration fixes completed!');
console.log('\nNext steps:');
console.log('1. Set up environment variables');
console.log('2. Run: npm run install:all');
console.log('3. Run: npm run build');
console.log('4. Run: npm run test');
console.log('5. Run: npm run dev');