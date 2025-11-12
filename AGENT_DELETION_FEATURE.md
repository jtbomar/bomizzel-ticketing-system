# Agent Deletion & Ticket Reassignment Feature

## Overview
When deactivating or deleting an agent, the system should check for assigned tickets and allow reassignment to prevent orphaned tickets.

## User Flow

### 1. Deactivate Agent (Soft Delete)
**Current Behavior:**
- Marks user as `isActive: false`
- User remains in database
- Can be reactivated later

**Enhanced Behavior:**
1. Click "Deactivate" button
2. System checks for assigned tickets
3. If tickets exist:
   - Show modal: "This agent has X assigned tickets"
   - Options:
     - Reassign to another agent (dropdown of active agents)
     - Mark as Unassigned
     - Cancel
4. After reassignment, deactivate the agent
5. If no tickets, deactivate immediately

### 2. Permanently Delete Agent (Hard Delete)
**New Feature:**
- Adds "Permanently Delete" button (only for inactive users)
- Permanently removes user from database
- Cannot be undone

**Flow:**
1. User must first be deactivated
2. Click "Permanently Delete" button
3. System checks for any historical ticket associations
4. Show warning: "This will permanently delete the agent. This cannot be undone."
5. Confirm deletion
6. Remove from database

## Database Considerations

### Ticket Assignment
Tickets have an `assigned_to` field (user_id):
```sql
SELECT COUNT(*) FROM tickets WHERE assigned_to = 'user_id' AND status != 'closed';
```

### Reassignment Options
1. **Reassign to Agent**: Update `assigned_to` to new agent's ID
2. **Unassigned**: Set `assigned_to` to NULL
3. **Keep Assignment**: Leave tickets assigned (for reactivation later)

## Implementation Plan

### Backend API Endpoints

#### 1. Check Assigned Tickets
```
GET /api/admin/users/:userId/assigned-tickets
Response: {
  count: number,
  openTickets: number,
  closedTickets: number
}
```

#### 2. Reassign Tickets
```
POST /api/admin/users/:userId/reassign-tickets
Body: {
  newAssigneeId: string | null,  // null for unassigned
  includeClosedTickets: boolean
}
```

#### 3. Permanently Delete User
```
DELETE /api/admin/users/:userId/permanent
```

### Frontend Components

#### 1. Ticket Reassignment Modal
```tsx
<ReassignTicketsModal
  agent={agent}
  ticketCount={ticketCount}
  availableAgents={activeAgents}
  onReassign={(newAgentId) => handleReassign(newAgentId)}
  onCancel={() => closeModal()}
/>
```

#### 2. Updated Delete Button
```tsx
<button onClick={() => handleDeactivate(agent)}>
  Deactivate
</button>
{!agent.isActive && (
  <button onClick={() => handlePermanentDelete(agent)}>
    Permanently Delete
  </button>
)}
```

## UI/UX Design

### Reassignment Modal
```
┌─────────────────────────────────────────────┐
│  Reassign Tickets                      [X]  │
├─────────────────────────────────────────────┤
│                                             │
│  ⚠️  Elena Bomar has 15 assigned tickets   │
│                                             │
│  Before deactivating, please reassign:     │
│                                             │
│  ○ Reassign to:                            │
│    [Select Agent ▼]                        │
│                                             │
│  ○ Mark as Unassigned                      │
│                                             │
│  ○ Keep assigned (for reactivation)       │
│                                             │
│  [ ] Include closed tickets (3)            │
│                                             │
│  ┌─────────────────────────────────────┐  │
│  │ Ticket Details:                     │  │
│  │ • Open: 12                          │  │
│  │ • In Progress: 3                    │  │
│  │ • Closed: 3                         │  │
│  └─────────────────────────────────────┘  │
│                                             │
│         [Cancel]  [Reassign & Deactivate]  │
└─────────────────────────────────────────────┘
```

### Permanent Delete Confirmation
```
┌─────────────────────────────────────────────┐
│  ⚠️  Permanently Delete Agent          [X]  │
├─────────────────────────────────────────────┤
│                                             │
│  Are you sure you want to permanently      │
│  delete Elena Bomar?                       │
│                                             │
│  This action:                              │
│  • Cannot be undone                        │
│  • Removes all user data                   │
│  • Keeps ticket history for audit          │
│                                             │
│  Type "DELETE" to confirm:                 │
│  [________________]                        │
│                                             │
│         [Cancel]  [Permanently Delete]     │
└─────────────────────────────────────────────┘
```

## Safety Features

### 1. Prevent Accidental Deletion
- Require typing "DELETE" to confirm permanent deletion
- Show warning about consequences
- Disable button until confirmation typed

### 2. Audit Trail
- Log all deactivations and deletions
- Track who performed the action
- Record ticket reassignments

### 3. Restrictions
- Cannot delete yourself
- Cannot delete the last admin
- Cannot permanently delete if tickets still assigned

## Database Schema Updates

### Add Audit Log Table
```sql
CREATE TABLE user_management_audit (
  id SERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL,  -- 'deactivate', 'reactivate', 'delete', 'reassign'
  target_user_id UUID NOT NULL,
  performed_by_user_id UUID NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## API Response Examples

### Check Assigned Tickets
```json
{
  "userId": "uuid",
  "userName": "Elena Bomar",
  "tickets": {
    "total": 15,
    "open": 12,
    "closed": 3,
    "byStatus": {
      "new": 5,
      "in_progress": 7,
      "closed": 3
    }
  }
}
```

### Reassign Success
```json
{
  "success": true,
  "ticketsReassigned": 12,
  "newAssignee": {
    "id": "uuid",
    "name": "John Doe"
  },
  "userDeactivated": true
}
```

## Error Handling

### Common Errors
1. **User has tickets**: Show reassignment modal
2. **Cannot delete last admin**: "Cannot delete the last administrator"
3. **Cannot delete self**: "You cannot delete your own account"
4. **User not found**: "User not found or already deleted"

## Testing Checklist

- [ ] Deactivate agent with no tickets
- [ ] Deactivate agent with open tickets
- [ ] Reassign tickets to another agent
- [ ] Mark tickets as unassigned
- [ ] Keep tickets assigned during deactivation
- [ ] Reactivate agent with kept assignments
- [ ] Permanently delete inactive agent
- [ ] Prevent deletion of last admin
- [ ] Prevent self-deletion
- [ ] Verify audit log entries
- [ ] Test with closed tickets
- [ ] Test with mixed ticket statuses

## Future Enhancements

1. **Bulk Reassignment**: Reassign multiple agents' tickets at once
2. **Smart Reassignment**: Suggest agents based on workload, skills, or department
3. **Scheduled Deactivation**: Set a future date for deactivation
4. **Offboarding Workflow**: Multi-step process for employee departure
5. **Ticket Transfer History**: Track all reassignments for a ticket

## Implementation Priority

### Phase 1 (Essential)
- Check for assigned tickets before deactivation
- Basic reassignment modal
- Reassign to agent or unassigned

### Phase 2 (Important)
- Permanent delete functionality
- Audit logging
- Safety confirmations

### Phase 3 (Nice to Have)
- Smart reassignment suggestions
- Bulk operations
- Advanced reporting

## Notes

- This feature is critical for maintaining data integrity
- Should be implemented before production deployment
- Consider adding to the admin training documentation
- May want to add permissions (only super admins can permanently delete)

---

**Status**: Documented, ready for implementation
**Estimated Time**: 4-6 hours for Phase 1
**Dependencies**: Tickets table, User management API
