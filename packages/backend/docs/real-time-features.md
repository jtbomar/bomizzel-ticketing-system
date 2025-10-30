# Real-Time Features Documentation

## Overview

The Bomizzel ticketing system implements comprehensive real-time features using Socket.IO to provide instant updates and notifications to users. This enables a responsive and collaborative experience for both customers and employees.

## Architecture

### Backend Components

1. **NotificationService** (`src/services/NotificationService.ts`)
   - Manages WebSocket connections and real-time notifications
   - Handles user authentication and room management
   - Broadcasts notifications to specific users, teams, or queues

2. **MetricsService** (`src/services/MetricsService.ts`)
   - Calculates and broadcasts queue metrics in real-time
   - Provides periodic metrics updates
   - Triggers metrics updates when tickets change

3. **Socket.IO Integration** (`src/index.ts`)
   - Initializes Socket.IO server with CORS configuration
   - Starts periodic metrics updates
   - Handles graceful shutdown

### Frontend Components

1. **SocketContext** (`src/contexts/SocketContext.tsx`)
   - Manages WebSocket connection state
   - Provides socket instance to components
   - Handles connection/disconnection events

2. **useNotifications Hook** (`src/hooks/useNotifications.ts`)
   - Manages real-time notifications
   - Converts server notifications to display format
   - Handles browser notifications for high-priority items

3. **NotificationCenter Component** (`src/components/NotificationCenter.tsx`)
   - Displays notification dropdown with unread count
   - Provides notification management (mark as read, clear all)
   - Shows notification history with timestamps

4. **Real-Time Hooks**
   - `useRealTimeQueue`: Manages queue room subscriptions
   - `useRealTimeMetrics`: Handles live metrics updates
   - `useTickets`: Listens for ticket updates

## Real-Time Events

### Server-to-Client Events

#### Ticket Events
- `ticket:created` - New ticket created
- `ticket:assigned` - Ticket assigned to employee
- `ticket:status_changed` - Ticket status updated
- `ticket:updated` - General ticket updates
- `ticket:priority_changed` - Ticket priority changed

#### Queue Events
- `queue:metrics_updated` - Queue metrics refreshed
- `queue:ticket_added` - Ticket added to queue
- `queue:ticket_removed` - Ticket removed from queue

#### User Events
- `user:ticket_assigned` - User-specific assignment notification
- `user:mention` - User mentioned in note/comment
- `user:queue_updated` - User's queue configuration changed

### Client-to-Server Events

#### Authentication
- `authenticate` - Authenticate user with JWT token
- `authenticated` - Server response to authentication

#### Room Management
- `join_team` - Join team-specific room
- `leave_team` - Leave team room
- `join_queue` - Join queue-specific room
- `leave_queue` - Leave queue room

## Room Structure

### User Rooms
- `user:{userId}` - Personal notifications for specific user

### Team Rooms
- `team:{teamId}` - Team-wide notifications and updates

### Queue Rooms
- `queue:{queueId}` - Queue-specific updates and metrics

## Notification Types

### High Priority (Browser Notifications)
- Ticket assignments to current user
- Urgent status changes
- Direct mentions

### Medium Priority (In-App Notifications)
- New tickets in watched queues
- Status changes on assigned tickets
- Team announcements

### Low Priority (Background Updates)
- Metrics updates
- General ticket updates
- Queue statistics

## Implementation Details

### Authentication Flow
1. Client connects to Socket.IO server
2. Client sends `authenticate` event with user ID and JWT token
3. Server validates token and stores user-socket mapping
4. Server joins user to appropriate rooms based on role and permissions
5. Client receives `authenticated` confirmation

### Notification Broadcasting
1. Business logic triggers notification (e.g., ticket creation)
2. NotificationService creates structured notification payload
3. Service determines target audience (user, team, queue)
4. Notification broadcast to appropriate rooms
5. Clients receive and process notifications

### Metrics Updates
1. Ticket changes trigger metrics recalculation
2. MetricsService calculates new queue metrics
3. Updated metrics broadcast to queue watchers
4. Frontend updates dashboard displays in real-time
5. Periodic background updates ensure consistency

## Browser Notifications

### Permission Handling
- Request permission on first user interaction
- Graceful fallback if notifications not supported
- Respect user's browser notification settings

### Notification Content
- Title: Brief description of event
- Body: Detailed message with context
- Icon: Application favicon
- Auto-dismiss after 5 seconds

## Performance Considerations

### Connection Management
- Automatic reconnection on network issues
- Graceful handling of connection drops
- Efficient room management to minimize memory usage

### Scalability
- Room-based broadcasting reduces unnecessary traffic
- Periodic cleanup of inactive connections
- Metrics updates batched to prevent spam

### Error Handling
- Robust error handling for socket events
- Fallback to polling for critical updates
- Logging of connection issues for monitoring

## Security Features

### Authentication
- JWT token validation for socket connections
- User-socket mapping for access control
- Automatic disconnection on token expiry

### Authorization
- Room access based on user permissions
- Team and queue membership validation
- Prevent unauthorized data access

### Data Protection
- No sensitive data in real-time payloads
- Reference-based notifications (IDs only)
- Secure room naming conventions

## Configuration

### Environment Variables
```bash
# Socket.IO Configuration
FRONTEND_URL=http://localhost:3000  # CORS origin
SOCKET_IO_PORT=5000                 # Socket.IO port (same as API)

# Metrics Configuration
METRICS_UPDATE_INTERVAL=5           # Minutes between metric updates
```

### Client Configuration
```typescript
// Socket.IO client configuration
const socket = io(API_URL, {
  transports: ['websocket', 'polling'],
  timeout: 10000,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
```

## Monitoring and Debugging

### Server-Side Logging
- Connection/disconnection events
- Authentication attempts
- Room join/leave activities
- Notification broadcast events
- Error conditions and failures

### Client-Side Debugging
- Connection state monitoring
- Notification receipt logging
- Room subscription tracking
- Performance metrics collection

### Health Checks
- Socket.IO server status endpoint
- Connected users count
- Active rooms monitoring
- Message throughput tracking

## Testing

### Unit Tests
- NotificationService methods
- MetricsService calculations
- Socket event handlers
- Notification formatting

### Integration Tests
- End-to-end notification flow
- Room management functionality
- Authentication and authorization
- Metrics update propagation

### Load Testing
- Concurrent connection handling
- Message broadcasting performance
- Room scalability limits
- Memory usage under load

## Future Enhancements

### Planned Features
- Typing indicators for collaborative editing
- Presence indicators (online/offline status)
- Real-time collaborative ticket editing
- Voice/video call integration
- Mobile push notifications

### Performance Improvements
- Redis adapter for horizontal scaling
- Message queuing for reliability
- Compression for large payloads
- CDN integration for global distribution