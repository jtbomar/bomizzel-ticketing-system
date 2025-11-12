#!/bin/bash
# Database health check script
# Usage: ./scripts/db-health.sh

CONTAINER="bomizzel-postgres"
DB_USER="bomizzel_user"
DB_NAME="bomizzel_db"

function run_query() {
  docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "$1" 2>/dev/null
}

echo "🏥 Database Health Check"
echo "========================"
echo ""

# Check if container is running
if ! docker ps | grep -q $CONTAINER; then
  echo "❌ PostgreSQL container is not running!"
  echo "   Run: npm run docker:up"
  exit 1
fi
echo "✅ PostgreSQL container is running"

# Check database connection
if ! run_query "SELECT 1;" > /dev/null 2>&1; then
  echo "❌ Cannot connect to database!"
  exit 1
fi
echo "✅ Database connection successful"

# Check record counts
echo ""
echo "📊 Record Counts:"
USER_COUNT=$(run_query "SELECT COUNT(*) FROM users;" | tr -d ' ')
COMPANY_COUNT=$(run_query "SELECT COUNT(*) FROM companies;" | tr -d ' ')
SUB_COUNT=$(run_query "SELECT COUNT(*) FROM customer_subscriptions;" | tr -d ' ')
TICKET_COUNT=$(run_query "SELECT COUNT(*) FROM tickets;" | tr -d ' ')

echo "   Users: $USER_COUNT"
echo "   Companies: $COMPANY_COUNT"
echo "   Subscriptions: $SUB_COUNT"
echo "   Tickets: $TICKET_COUNT"

# Check for inactive users
INACTIVE_USERS=$(run_query "SELECT COUNT(*) FROM users WHERE is_active = false;" | tr -d ' ')
if [ "$INACTIVE_USERS" -gt 0 ]; then
  echo ""
  echo "⚠️  Warning: $INACTIVE_USERS inactive user(s)"
fi

# Check for inactive companies
INACTIVE_COMPANIES=$(run_query "SELECT COUNT(*) FROM companies WHERE is_active = false;" | tr -d ' ')
if [ "$INACTIVE_COMPANIES" -gt 0 ]; then
  echo "⚠️  Warning: $INACTIVE_COMPANIES inactive company(ies)"
fi

# Check for suspended subscriptions
SUSPENDED_SUBS=$(run_query "SELECT COUNT(*) FROM customer_subscriptions WHERE status = 'suspended';" | tr -d ' ')
if [ "$SUSPENDED_SUBS" -gt 0 ]; then
  echo "⚠️  Warning: $SUSPENDED_SUBS suspended subscription(s)"
fi

# Check admin users
ADMIN_COUNT=$(run_query "SELECT COUNT(*) FROM users WHERE role = 'admin';" | tr -d ' ')
echo ""
echo "👑 Admin Users: $ADMIN_COUNT"

# Check provisioned customers
PROVISIONED_COUNT=$(run_query "SELECT COUNT(*) FROM customer_subscriptions WHERE is_custom = true;" | tr -d ' ')
echo "🎯 Provisioned Customers: $PROVISIONED_COUNT"

# Check database size
DB_SIZE=$(run_query "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" | tr -d ' ')
echo ""
echo "💾 Database Size: $DB_SIZE"

# Check for recent activity
RECENT_USERS=$(run_query "SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours';" | tr -d ' ')
RECENT_TICKETS=$(run_query "SELECT COUNT(*) FROM tickets WHERE created_at > NOW() - INTERVAL '24 hours';" | tr -d ' ')

echo ""
echo "📈 Last 24 Hours:"
echo "   New Users: $RECENT_USERS"
echo "   New Tickets: $RECENT_TICKETS"

echo ""
echo "✅ Health check complete!"
