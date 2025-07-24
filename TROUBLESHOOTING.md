# Troubleshooting Guide

This guide covers common issues you might encounter while developing or running the Voice AI RPG Game.

## Quick Diagnostics

Run these commands to quickly identify common issues:

```bash
# Health check
npm run health-check

# Build verification
npm run build
node scripts/build-verify.js

# Check environment
node -e "console.log('Node:', process.version); console.log('NPM:', require('child_process').execSync('npm -v').toString().trim())"
```

## Installation Issues

### Node.js Version Mismatch

**Problem**: Error messages about unsupported Node.js version
```
error: The engine "node" is incompatible with this module
```

**Solution**:
```bash
# Check your Node.js version
node --version

# Install Node.js 18+ from https://nodejs.org/
# Or use nvm (recommended)
nvm install 18
nvm use 18
```

### NPM Installation Failures

**Problem**: Dependencies fail to install
```
npm ERR! peer dep missing
npm ERR! code ERESOLVE
```

**Solutions**:
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
npm run reset

# Use legacy peer deps (if needed)
npm install --legacy-peer-deps

# Check for conflicting global packages
npm list -g --depth=0
```

### Permission Errors (macOS/Linux)

**Problem**: EACCES permission errors during installation

**Solution**:
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Or use nvm instead of system Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

## Development Server Issues

### Port Already in Use

**Problem**: 
```
Error: listen EADDRINUSE: address already in use :::3000
Error: listen EADDRINUSE: address already in use :::3001
```

**Solutions**:
```bash
# Find and kill processes using the ports
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9

# Or use different ports
# Edit package.json scripts or .env files
PORT=3002 npm run dev:backend
```

### Frontend Not Loading

**Problem**: Frontend shows blank page or connection errors

**Checklist**:
1. Check if backend is running on port 3001
2. Verify proxy configuration in `frontend/vite.config.ts`
3. Check browser console for errors
4. Verify environment variables in `frontend/.env`

**Solutions**:
```bash
# Check if backend is responding
curl http://localhost:3001/api/health

# Restart development servers
npm run dev

# Clear browser cache and reload
# Check Network tab in browser dev tools
```

### Hot Reload Not Working

**Problem**: Changes don't reflect automatically

**Solutions**:
```bash
# Restart development server
npm run dev

# Check file watchers (Linux)
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Clear Vite cache
rm -rf frontend/node_modules/.vite
```

## Build Issues

### TypeScript Compilation Errors

**Problem**: Build fails with TypeScript errors

**Common Errors and Solutions**:

1. **Import/Export Errors**:
   ```bash
   # Check path aliases in tsconfig.json
   # Verify file extensions (.ts, .tsx)
   # Check for circular dependencies
   ```

2. **Type Errors**:
   ```bash
   # Update type definitions
   npm install --save-dev @types/node @types/react

   # Check for missing type exports
   # Verify interface definitions
   ```

3. **Module Resolution**:
   ```bash
   # Clear TypeScript cache
   rm -rf frontend/node_modules/.cache
   rm -rf backend/node_modules/.cache
   
   # Restart TypeScript server in your editor
   ```

### Vite Build Failures

**Problem**: Frontend build fails

**Solutions**:
```bash
# Clear Vite cache
rm -rf frontend/node_modules/.vite
rm -rf frontend/dist

# Check for large assets
du -sh frontend/src/assets/*

# Increase memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build:frontend
```

### Backend Build Issues

**Problem**: Backend TypeScript compilation fails

**Solutions**:
```bash
# Check tsconfig.json configuration
# Verify all imports have proper extensions
# Check for unused imports (if strict mode enabled)

# Build with verbose output
cd backend && npx tsc --build --verbose

# Skip lib check if needed (temporary fix)
# Edit tsconfig.json: "skipLibCheck": true
```

## Runtime Issues

### API Connection Errors

**Problem**: Frontend can't connect to backend API

**Symptoms**:
- Network errors in browser console
- "Failed to fetch" errors
- WebSocket connection failures

**Solutions**:
```bash
# Check if backend is running
curl http://localhost:3001/api/health

# Verify CORS configuration
# Check backend/.env CORS_ORIGIN setting

# Test WebSocket connection
# Open browser dev tools > Network > WS tab

# Check firewall/antivirus blocking connections
```

### Environment Variable Issues

**Problem**: Environment variables not loading

**Symptoms**:
- API keys not found
- Configuration defaults being used
- "Environment validation failed" errors

**Solutions**:
```bash
# Verify .env files exist
ls -la backend/.env frontend/.env

# Check environment loading
node -e "require('dotenv').config({path: 'backend/.env'}); console.log(process.env.OPENAI_API_KEY ? 'API key loaded' : 'API key missing')"

# Verify VITE_ prefix for frontend variables
grep VITE_ frontend/.env

# Check for trailing spaces or quotes in .env files
cat -A backend/.env
```

### Audio/Voice Issues

**Problem**: Voice input or TTS not working

**Common Issues**:

1. **Microphone Permission**:
   ```bash
   # Check browser permissions
   # Look for permission prompts
   # Test in different browsers
   ```

2. **HTTPS Required**:
   ```bash
   # Voice features require HTTPS in production
   # Use localhost for development
   # Check mixed content warnings
   ```

3. **Audio Format Issues**:
   ```bash
   # Check supported formats in backend/.env
   # Verify MAX_AUDIO_FILE_SIZE setting
   # Test with different audio files
   ```

4. **API Key Issues**:
   ```bash
   # Verify OpenAI API key is valid
   curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models
   
   # Check API quota/billing
   # Test with MOCK_OPENAI_API=true
   ```

## Performance Issues

### Slow Development Server

**Problem**: Development server is slow to start or respond

**Solutions**:
```bash
# Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"

# Disable source maps temporarily
# Edit vite.config.ts: build.sourcemap = false

# Clear all caches
npm run clean:cache

# Check for large files in src/
find frontend/src -size +1M -type f
```

### High Memory Usage

**Problem**: Development server uses too much memory

**Solutions**:
```bash
# Monitor memory usage
top -p $(pgrep node)

# Reduce TypeScript checking
# Edit tsconfig.json: "skipLibCheck": true

# Limit concurrent processes
# Use npm run dev:backend and npm run dev:frontend separately

# Close unused browser tabs
# Restart development servers periodically
```

### Slow Build Times

**Problem**: Build process takes too long

**Solutions**:
```bash
# Use build cache
npm run build

# Parallel builds
npm run build:backend & npm run build:frontend & wait

# Optimize bundle size
npm run build:analyze

# Check for large dependencies
npx webpack-bundle-analyzer frontend/dist/stats.json
```

## Testing Issues

### Tests Failing

**Problem**: Unit tests fail unexpectedly

**Common Issues**:

1. **Environment Setup**:
   ```bash
   # Check test setup files
   ls frontend/src/test-setup.ts
   
   # Verify test environment
   cd frontend && npm test -- --reporter=verbose
   ```

2. **Mock Issues**:
   ```bash
   # Check mock implementations
   # Verify mock file locations
   # Clear Jest/Vitest cache
   rm -rf frontend/node_modules/.cache
   ```

3. **Async Test Issues**:
   ```bash
   # Check for proper async/await usage
   # Verify test timeouts
   # Look for unhandled promise rejections
   ```

### Test Coverage Issues

**Problem**: Coverage reports are incorrect

**Solutions**:
```bash
# Clear coverage cache
rm -rf frontend/coverage backend/coverage

# Run coverage with clean slate
npm run test:coverage

# Check coverage configuration
# Verify file inclusion/exclusion patterns
```

## Database/Storage Issues

### Cache Issues

**Problem**: Application cache causing problems

**Solutions**:
```bash
# Clear application cache
rm -rf backend/temp/
rm -rf backend/uploads/

# Clear browser cache
# Use incognito/private browsing mode

# Reset cache service
# Check CacheService configuration
```

### File System Issues

**Problem**: File read/write errors

**Solutions**:
```bash
# Check file permissions
ls -la backend/temp/ backend/uploads/

# Create missing directories
mkdir -p backend/temp backend/uploads

# Check disk space
df -h

# Verify file paths in configuration
```

## Network Issues

### WebSocket Connection Problems

**Problem**: Real-time features not working

**Symptoms**:
- Connection timeouts
- Frequent disconnections
- Messages not received

**Solutions**:
```bash
# Check WebSocket proxy configuration
# Verify vite.config.ts proxy settings

# Test WebSocket connection manually
# Use browser dev tools > Network > WS

# Check for network firewalls
# Test on different networks

# Verify Socket.io configuration
# Check CORS settings for WebSocket
```

### API Rate Limiting

**Problem**: API requests being rate limited

**Solutions**:
```bash
# Check OpenAI API usage
# Verify rate limiting configuration

# Implement request queuing
# Add retry logic with backoff

# Monitor API usage
# Check billing/quota limits
```

## Security Issues

### CORS Errors

**Problem**: Cross-origin request blocked

**Solutions**:
```bash
# Check CORS_ORIGIN in backend/.env
# Verify frontend URL matches exactly

# Test with CORS disabled (development only)
# Check preflight requests in Network tab

# Verify credentials handling
# Check CORS_CREDENTIALS setting
```

### API Key Exposure

**Problem**: API keys visible in frontend

**Solutions**:
```bash
# Verify VITE_ prefix usage
# Check that sensitive keys are backend-only

# Audit frontend bundle
npm run build:frontend
grep -r "sk-" frontend/dist/

# Use environment validation
# Check .gitignore includes .env files
```

## Deployment Issues

### Production Build Failures

**Problem**: Production build fails but development works

**Solutions**:
```bash
# Test production build locally
npm run build
npm run start

# Check environment variables
# Verify production .env files

# Test with production-like settings
NODE_ENV=production npm run dev
```

### Server Deployment Issues

**Problem**: Application doesn't work when deployed

**Common Issues**:
1. Environment variables not set
2. Build files not uploaded
3. Server configuration issues
4. HTTPS/SSL problems

**Solutions**:
```bash
# Verify build output
node scripts/build-verify.js

# Check server logs
# Verify file permissions

# Test API endpoints
curl https://your-domain.com/api/health

# Check SSL certificate
openssl s_client -connect your-domain.com:443
```

## Getting Help

If you're still experiencing issues:

1. **Check the logs**:
   ```bash
   # Backend logs
   tail -f backend/combined.log
   
   # Browser console
   # Network tab in dev tools
   ```

2. **Create a minimal reproduction**:
   - Start with a fresh clone
   - Follow setup steps exactly
   - Document the exact error

3. **Gather system information**:
   ```bash
   node --version
   npm --version
   uname -a  # Linux/macOS
   systeminfo  # Windows
   ```

4. **Search existing issues**:
   - Check repository issues
   - Search error messages
   - Look for similar problems

5. **Create a detailed issue report**:
   - Include error messages
   - Provide reproduction steps
   - Share relevant configuration
   - Include system information

## Emergency Recovery

If everything is broken:

```bash
# Nuclear option - complete reset
git stash  # Save any changes
git clean -fdx  # Remove all untracked files
npm run reset  # Clean install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit .env files with your settings
npm run dev
```

This should get you back to a working state, though you'll need to reconfigure your environment variables.