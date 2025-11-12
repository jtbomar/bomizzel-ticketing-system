# Server Restart Guide

## Current Status

Both servers have been restarted:
- ✅ Backend: Process ID 45 (running on port 3001)
- ⚠️ Frontend: Process ID 46 (has syntax errors)

## How to Restart Servers

### Option 1: Using Kiro (What I just did)
```
Stop processes → Start new processes
```

### Option 2: Manual Terminal Commands

**Stop everything:**
```bash
# Kill all node processes (nuclear option)
pkill -f node

# Or use Ctrl+C in each terminal window
```

**Start backend:**
```bash
npm run dev:backend
```

**Start frontend:**
```bash
npm run dev:frontend
```

**Start both together:**
```bash
npm run dev
```

## Current Issue

The frontend has a syntax error in one of the React files. Let me check what's wrong.

## Quick Commands

### Check if servers are running:
```bash
# Check backend
curl http://localhost:3001/health

# Check frontend
curl http://localhost:3000
```

### Check what's using the ports:
```bash
lsof -i :3001  # Backend port
lsof -i :3000  # Frontend port
```

### Kill specific ports:
```bash
# Kill backend
lsof -ti:3001 | xargs kill -9

# Kill frontend
lsof -ti:3000 | xargs kill -9
```

## Typical Startup Sequence

1. **Start database** (if not running):
   ```bash
   npm run docker:up
   ```

2. **Start backend**:
   ```bash
   npm run dev:backend
   ```
   Should see: "🚀 Bomizzel backend server running on port 3001"

3. **Start frontend**:
   ```bash
   npm run dev:frontend
   ```
   Should see: "Local: http://localhost:3000/"

## Troubleshooting

### Backend won't start:
- Check if port 3001 is in use
- Check database is running
- Check .env file exists

### Frontend won't start:
- Check if port 3000 is in use
- Check for syntax errors in React files
- Clear node_modules and reinstall

### Both won't start:
- Check Node.js version (need 18+)
- Run `npm install` in root directory
- Check for TypeScript errors

## Status Check

Let me check the current status...