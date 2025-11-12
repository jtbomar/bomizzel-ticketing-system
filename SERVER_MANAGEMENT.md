# Server Management Guide

## Quick Commands

### Start Both Servers (Recommended)
```bash
npm run dev
```
This starts both frontend and backend together.

### Start Individual Servers

**Frontend Only:**
```bash
npm run dev:frontend
```
- Runs on: http://localhost:3000
- Uses Vite for hot module reloading

**Backend Only:**
```bash
npm run dev:backend
```
- Runs on: http://localhost:5000
- Uses nodemon for auto-restart on file changes

## Restart Servers

### Option 1: Stop and Restart (Clean Restart)

**Stop all servers:**
```bash
# Press Ctrl+C in the terminal where servers are running
# Or if running in background, find and kill the process:
lsof -ti:3000 | xargs kill -9  # Kill frontend
lsof -ti:5000 | xargs kill -9  # Kill backend
```

**Then start again:**
```bash
npm run dev
```

### Option 2: Quick Restart (Without Stopping)

The servers auto-restart when you save files:
- **Frontend**: Automatically hot-reloads on file changes
- **Backend**: Automatically restarts via nodemon on file changes

If auto-restart isn't working:
1. Save a file in the respective package
2. Or manually restart by pressing `rs` + Enter in the terminal

## Check Server Status

**Check if servers are running:**
```bash
# Check frontend (port 3000)
lsof -i:3000

# Check backend (port 5000)
lsof -i:5000

# Or use curl to test
curl http://localhost:3000  # Frontend
curl http://localhost:5000/health  # Backend health check
```

## Common Issues & Solutions

### Port Already in Use

**Error:** `Port 3000 is already in use`

**Solution:**
```bash
# Kill the process using the port
lsof -ti:3000 | xargs kill -9  # For frontend
lsof -ti:5000 | xargs kill -9  # For backend
```

### Backend Not Connecting to Database

**Check Docker containers:**
```bash
docker ps
```

**Start database if not running:**
```bash
npm run docker:up
```

### Frontend Not Loading Changes

**Hard refresh browser:**
- Mac: `Cmd + Shift + R`
- Windows/Linux: `Ctrl + Shift + R`

**Or clear Vite cache:**
```bash
rm -rf packages/frontend/node_modules/.vite
npm run dev:frontend
```

### Backend Not Picking Up Route Changes

**Restart backend:**
```bash
# Stop with Ctrl+C, then:
npm run dev:backend
```

## Development Workflow

### Typical Development Session

1. **Start everything:**
   ```bash
   npm run docker:up    # Start databases
   npm run dev          # Start both servers
   ```

2. **Make changes:**
   - Edit files in `packages/frontend/src/` or `packages/backend/src/`
   - Servers auto-reload

3. **Test changes:**
   - Frontend: Refresh browser or it auto-updates
   - Backend: Changes apply automatically via nodemon

4. **End session:**
   ```bash
   # Press Ctrl+C to stop servers
   npm run docker:down  # Optional: Stop databases
   ```

## Server Logs

### View Logs

**Frontend logs:**
- Displayed in terminal where `npm run dev:frontend` is running
- Also visible in browser console (F12)

**Backend logs:**
- Displayed in terminal where `npm run dev:backend` is running
- Structured logs with timestamps

### Debug Mode

**Enable verbose logging:**
```bash
# Backend
DEBUG=* npm run dev:backend

# Or set in .env file
LOG_LEVEL=debug
```

## Package.json Scripts Reference

Located in root `package.json`:

```json
{
  "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
  "dev:backend": "npm run dev --workspace=backend",
  "dev:frontend": "npm run dev --workspace=frontend",
  "build": "npm run build --workspaces",
  "test": "npm run test --workspaces",
  "docker:up": "docker-compose up -d",
  "docker:down": "docker-compose down"
}
```

## Network Access

### Local Development
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

### Network Access (Other Devices)
- Frontend: http://192.168.0.133:3000
- Backend: http://192.168.0.133:5000

Make sure your firewall allows connections on these ports.

## Production Deployment

### Build for Production
```bash
npm run build
```

### Start Production Servers
```bash
# Backend
npm run start --workspace=backend

# Frontend (serve built files)
npm run preview --workspace=frontend
```

## Troubleshooting Checklist

When things aren't working:

1. ✅ Are databases running? `docker ps`
2. ✅ Are servers running? `lsof -i:3000` and `lsof -i:5000`
3. ✅ Did you run migrations? `npm run migrate --workspace=backend`
4. ✅ Are there TypeScript errors? Check terminal output
5. ✅ Did you hard refresh browser? `Cmd+Shift+R`
6. ✅ Check browser console for errors (F12)
7. ✅ Check backend terminal for errors

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│  QUICK COMMANDS                                         │
├─────────────────────────────────────────────────────────┤
│  Start Everything:     npm run dev                      │
│  Start Frontend:       npm run dev:frontend             │
│  Start Backend:        npm run dev:backend              │
│  Start Database:       npm run docker:up                │
│  Stop Database:        npm run docker:down              │
│  Run Migrations:       npm run migrate --workspace=backend │
│  Kill Frontend:        lsof -ti:3000 | xargs kill -9   │
│  Kill Backend:         lsof -ti:5000 | xargs kill -9   │
│  Hard Refresh:         Cmd+Shift+R (Mac)                │
│                        Ctrl+Shift+R (Win/Linux)         │
└─────────────────────────────────────────────────────────┘
```

## Additional Resources

- **Database Guide:** `DATABASE_GUIDE.md`
- **Security Guide:** `START_HERE_SECURITY.md`
- **Network Access:** `NETWORK_ACCESS_GUIDE.md`
- **README:** `README.md`

---

**Pro Tip:** Keep this file open in a separate terminal or editor window for quick reference during development!
