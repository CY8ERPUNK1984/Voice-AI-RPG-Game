# Environment Variables Setup

## Quick Setup

### 1. Backend Environment Variables

```bash
# Copy the example file
cp backend/.env.example backend/.env

# Edit the file and add your tokens
nano backend/.env  # or use your preferred editor
```

### 2. Frontend Environment Variables

```bash
# Copy the example file  
cp frontend/.env.example frontend/.env

# Edit if needed (most defaults should work for development)
nano frontend/.env
```

## Required API Keys

### GitHub Personal Access Token
1. Go to GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `workflow`, `write:packages`
4. Copy the token and paste it in your `.env` file

### OpenAI API Key (Required for AI features)
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy and paste in your `.env` file

### Anthropic API Key (Optional - alternative to OpenAI)
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Copy and paste in your `.env` file

## Example .env file for backend:

```bash
# Copy this to backend/.env and fill in your values

PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000

# Add your actual API keys here
OPENAI_API_KEY=sk-your-openai-key-here
OPENAI_MODEL=gpt-4
OPENAI_TTS_MODEL=tts-1
OPENAI_TTS_VOICE=alloy

# GitHub token for repository operations
GITHUB_TOKEN=ghp_your-github-token-here
GITHUB_USERNAME=your-username

# Optional: Anthropic as alternative
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
ANTHROPIC_MODEL=claude-3-sonnet-20240229

# Audio settings
MAX_AUDIO_FILE_SIZE=10485760
SUPPORTED_AUDIO_FORMATS=mp3,wav,ogg,webm
AUDIO_UPLOAD_PATH=uploads/audio

# Session settings
SESSION_TIMEOUT=3600000
MAX_CONVERSATION_HISTORY=50
MAX_CONCURRENT_SESSIONS=100

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

## Example .env file for frontend:

```bash
# Copy this to frontend/.env (most defaults work for development)

VITE_API_BASE_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001

VITE_ENABLE_VOICE_INPUT=true
VITE_ENABLE_TTS=true
VITE_ENABLE_DEBUG_MODE=false

VITE_DEFAULT_TTS_VOLUME=0.8
VITE_DEFAULT_ASR_SENSITIVITY=0.5
VITE_DEFAULT_VOICE_SPEED=1.0

VITE_APP_TITLE=Voice AI RPG Game
VITE_MAX_MESSAGE_LENGTH=1000
VITE_TYPING_INDICATOR_DELAY=500
```

## Security Notes

⚠️ **Important:**
- Never commit `.env` files to git
- Keep your API keys secret
- Rotate keys regularly
- Use different keys for development and production

## Verification

After setting up your environment variables, you can test them:

```bash
# Backend
cd backend
npm run dev

# Frontend (in another terminal)
cd frontend  
npm run dev
```

The backend should start on port 3001 and frontend on port 3000.