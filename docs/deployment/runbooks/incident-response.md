# Incident Response Runbook

This runbook provides step-by-step procedures for responding to incidents in the Bomizzel Ticketing System.

## Incident Classification

### Severity Levels

| Severity | Description | Response Time | Examples |
|----------|-------------|---------------|----------|
| **P0 - Critical** | Complete system outage | 15 minutes | Application down, database unavailable |
| **P1 - High** | Major functionality impacted | 1 hour | High error rates, slow response times |
| **P2 - Medium** | Minor functionality impacted | 4 hours | Non-critical features broken |
| **P3 - Low** | Cosmetic or minor issues | 24 hours | UI glitches, minor bugs |

## Incident Response Process

### 1. Detection and Alert
```
Alert Received → Initial Assessment → Severity Classification → Team Notification
```

### 2. Initial Response (First 15 minutes)
1. **Acknowledge the alert** in monitoring system
2. **Assess the impact** using monitoring dashboards
3. **Classify severity** based on impact and scope
4. **Notify the team** via appropriate channels
5. **Create incident ticket** in tracking system

### 3. Investigation and Diagnosis
1. **Gather information** from logs and monitoring
2. **Identify root cause** or contributing factors
3. **Document findings** in incident ticket
4. **Determine resolution approach**

### 4. Resolution and Recovery
1. **Implement fix** or workaround
2. **Verify resolution** using health checks
3. **Monitor for stability** over observation period
4. **Update stakeholders** on resolution

### 5. Post-Incident Activities
1. **Conduct post-mortem** (for P0/P1 incidents)
2. **Document lessons learned**
3. **Create action items** for improvements
4. **Update runbooks** and procedures

## Common Incident Scenarios

### Application Down (P0)

#### Symptoms
- Health check endpoints returning 5xx errors
- Application not responding to requests
- Users unable to access the system

#### Immediate Actions
```bash
# 1. Check application status
curl -f https://api.bomizzel.com/health
curl -f https://bomizzel.com/health

# 2. Check container/service status
docker-compose ps
# or
kubectl get pods -n bomizzel

# 3. Check recent deployments
git log --oneline -10
kubectl rollout history deployment/backend

# 4. Check system resources
./scripts/health-check.sh
```

#### Investigation Steps
1. **Check application logs**
   ```bash
   # Docker logs
   docker-compose logs backend --tail=100
   
   # Kubernetes logs
   kubectl logs -f deployment/backend -n bomizzel
   
   # File logs
   tail -f packages/backend/logs/app.log
   ```

2. **Check database connectivity**
   ```bash
   # Test database connection
   docker-compose exec postgres pg_isready -U bomizzel_user -d bomizzel_db
   
   # Check database logs
   docker-compose logs postgres --tail=50
   ```

3. **Check external dependencies**
   ```bash
   # Redis connectivity
   docker-compose exec redis redis-cli ping
   
   # External API health
   curl -f https://external-api.example.com/health
   ```

#### Resolution Actions
1. **If recent deployment caused issue**
   ```bash
   # Rollback deployment
   kubectl rollout undo deployment/backend
   
   # Or restart with previous image
   docker-compose down
   docker-compose up -d
   ```

2. **If database issue**
   ```bash
   # Restart database
   docker-compose restart postgres
   
   # Check for locks
   docker-compose exec postgres psql -U bomizzel_user -d bomizzel_db -c "SELECT * FROM pg_locks WHERE NOT granted;"
   ```

3. **If resource exhaustion**
   ```bash
   # Scale up resources
   kubectl scale deployment/backend --replicas=3
   
   # Or restart services
   docker-compose restart
   ```

### High Error Rate (P1)

#### Symptoms
- Error rate > 5% for sustained period
- Increased 5xx responses
- User complaints about errors

#### Investigation Steps
```bash
# 1. Check error patterns in logs
grep -i error packages/backend/logs/app.log | tail -20

# 2. Check specific error types
curl -s https://api.bomizzel.com/metrics | grep http_requests_total

# 3. Check database performance
docker-compose exec postgres psql -U bomizzel_user -d bomizzel_db -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;"
```

#### Resolution Actions
1. **If database performance issue**
   ```bash
   # Check slow queries
   # Kill long-running queries if necessary
   # Consider adding indexes
   ```

2. **If external API issue**
   ```bash
   # Check external service status
   # Implement circuit breaker
   # Use cached responses if available
   ```

### Database Issues (P0/P1)

#### Symptoms
- Database connection errors
- Slow query performance
- Lock timeouts

#### Investigation Steps
```bash
# 1. Check database status
docker-compose exec postgres pg_isready -U bomizzel_user -d bomizzel_db

# 2. Check connections
docker-compose exec postgres psql -U bomizzel_user -d bomizzel_db -c "
SELECT count(*) as connections, state 
FROM pg_stat_activity 
GROUP BY state;"

# 3. Check locks
docker-compose exec postgres psql -U bomizzel_user -d bomizzel_db -c "
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;"
```

#### Resolution Actions
```bash
# 1. Kill blocking queries (if safe)
docker-compose exec postgres psql -U bomizzel_user -d bomizzel_db -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'active' 
AND query_start < now() - interval '5 minutes';"

# 2. Restart database (last resort)
docker-compose restart postgres

# 3. Restore from backup (if corrupted)
./scripts/db-restore.sh latest_backup.dump --drop-existing
```

## Communication Templates

### Initial Incident Notification
```
🚨 INCIDENT ALERT - P[X] - [Brief Description]

Status: INVESTIGATING
Impact: [Description of user impact]
Started: [Timestamp]
ETA: [Estimated resolution time]

We are investigating [brief description]. 
Updates will be provided every [X] minutes.

Incident Commander: [Name]
```

### Status Update
```
📊 INCIDENT UPDATE - P[X] - [Brief Description]

Status: [INVESTIGATING/IDENTIFIED/RESOLVING/RESOLVED]
Impact: [Current impact description]
Progress: [What has been done/found]
Next Steps: [What will be done next]
ETA: [Updated ETA if changed]

Next update in [X] minutes.
```

### Resolution Notification
```
✅ INCIDENT RESOLVED - P[X] - [Brief Description]

Status: RESOLVED
Duration: [Total incident duration]
Root Cause: [Brief root cause]
Resolution: [What was done to fix it]

A post-mortem will be conducted within 24 hours.
Thank you for your patience.
```

## Escalation Procedures

### Escalation Matrix
| Time | Action | Contact |
|------|--------|---------|
| 0 min | Initial response | On-call engineer |
| 15 min | If no progress | Team lead |
| 30 min | If P0 unresolved | Engineering manager |
| 60 min | If still unresolved | CTO/VP Engineering |

### Contact Information
- **On-call Engineer**: Check PagerDuty schedule
- **Team Lead**: team-lead@bomizzel.com
- **Engineering Manager**: eng-manager@bomizzel.com
- **CTO**: cto@bomizzel.com

## Tools and Resources

### Monitoring and Alerting
- **Prometheus**: http://monitoring.bomizzel.com:9090
- **Grafana**: http://monitoring.bomizzel.com:3001
- **AlertManager**: http://monitoring.bomizzel.com:9093
- **PagerDuty**: https://bomizzel.pagerduty.com

### Logging and Tracing
- **Loki**: http://monitoring.bomizzel.com:3100
- **Jaeger**: http://monitoring.bomizzel.com:16686
- **Application Logs**: `packages/backend/logs/`

### Communication
- **Slack**: #bomizzel-incidents
- **Status Page**: https://status.bomizzel.com
- **Email**: incidents@bomizzel.com

### Documentation
- **Runbooks**: `/docs/deployment/runbooks/`
- **Architecture**: `/docs/architecture/`
- **API Docs**: https://api.bomizzel.com/docs

## Post-Incident Review

### Post-Mortem Template
1. **Incident Summary**
   - What happened?
   - When did it happen?
   - How long did it last?
   - What was the impact?

2. **Timeline**
   - Detection time
   - Response time
   - Resolution time
   - Key events during incident

3. **Root Cause Analysis**
   - What was the root cause?
   - What were contributing factors?
   - Why wasn't it caught earlier?

4. **Response Evaluation**
   - What went well?
   - What could be improved?
   - Were procedures followed?

5. **Action Items**
   - Immediate fixes
   - Long-term improvements
   - Process changes
   - Monitoring enhancements

### Continuous Improvement
- Review incident trends monthly
- Update runbooks based on learnings
- Conduct incident response training
- Test disaster recovery procedures