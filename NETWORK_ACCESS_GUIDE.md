# Network Access Guide

## Your Current Setup

**Your Mac's IP Address**: `192.168.0.133`

**Access URLs**:
- Frontend: `http://192.168.0.133:3000`
- Backend API: `http://192.168.0.133:3001`

## Quick Test

From another device on your network, try:
```
http://192.168.0.133:3000
```

## If It Doesn't Work

### 1. Check Firewall (macOS)

```bash
# Check if firewall is on
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# If firewall is on, allow Node.js
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/local/bin/node
```

Or use System Preferences:
1. Open **System Preferences** → **Security & Privacy** → **Firewall**
2. Click **Firewall Options**
3. Add Node.js to allowed apps
4. Or temporarily turn off firewall for testing

### 2. Verify Servers Are Running

```bash
# Check if ports are listening
lsof -i :3000  # Frontend
lsof -i :3001  # Backend
```

Should show Node.js processes listening on 0.0.0.0:3000 and 0.0.0.0:3001

### 3. Test Locally First

From your Mac:
```bash
# Test frontend
curl http://localhost:3000

# Test from network IP
curl http://192.168.0.133:3000

# Test backend
curl http://192.168.0.133:3001/api/health
```

### 4. Check Vite Configuration

The config is already set correctly:
```typescript
server: {
  port: 3000,
  host: '0.0.0.0', // ✅ Allows external connections
}
```

### 5. Restart Servers

If you made changes:
```bash
# Stop servers
# Ctrl+C in terminal or:
npm run dev

# Or restart individual servers
npm run dev:frontend
npm run dev:backend
```

## Common Issues

### Issue 1: Wrong IP Address
**Problem**: Using 192.168.0.117 instead of 192.168.0.133
**Solution**: Use the correct IP from `ifconfig`

### Issue 2: Firewall Blocking
**Problem**: macOS firewall blocking incoming connections
**Solution**: Allow Node.js in firewall settings

### Issue 3: VPN Active
**Problem**: VPN might route traffic differently
**Solution**: Temporarily disable VPN for testing

### Issue 4: Different Network
**Problem**: Devices on different networks/subnets
**Solution**: Ensure both devices are on same WiFi network

## Quick Firewall Fix

```bash
# Temporarily allow all incoming connections (for testing only!)
sudo pfctl -d  # Disable packet filter

# Re-enable when done
sudo pfctl -e
```

## Verify Network Access

From another device (phone, tablet, another computer):

1. **Connect to same WiFi** as your Mac
2. **Open browser** and go to: `http://192.168.0.133:3000`
3. **Should see** the Bomizzel login page

## Alternative: Use ngrok (for external access)

If you need to access from outside your network:

```bash
# Install ngrok
brew install ngrok

# Expose frontend
ngrok http 3000

# Expose backend
ngrok http 3001
```

This gives you public URLs like:
- `https://abc123.ngrok.io` → your frontend
- `https://def456.ngrok.io` → your backend

## Current Server Status

Frontend: ✅ Running on 0.0.0.0:3000
Backend: ✅ Running on 0.0.0.0:3001

**Your IP**: 192.168.0.133

**Access from network**: http://192.168.0.133:3000

## Troubleshooting Commands

```bash
# Find your IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# Check what's listening on port 3000
lsof -i :3000

# Check firewall status
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Test connection from Mac
curl -I http://192.168.0.133:3000

# Check if port is accessible
nc -zv 192.168.0.133 3000
```

## Summary

✅ **Correct URL**: `http://192.168.0.133:3000` (not .117)
✅ **Vite configured**: Already set to allow network access
✅ **Servers running**: Both frontend and backend are up

**Most likely issue**: Using wrong IP address (192.168.0.117 vs 192.168.0.133)

**Try this**: `http://192.168.0.133:3000`
