#!/bin/bash
# Common database queries for troubleshooting
# Usage: ./scripts/db-common-queries.sh [command]

CONTAINER="bomizzel-postgres"
DB_USER="bomizzel_user"
DB_NAME="bomizzel_db"

function run_query() {
  docker exec -it $CONTAINER psql -U $DB_USER -d $DB_NAME -c "$1"
}

case "$1" in
  "tables")
    echo "📋 Listing all tables..."
    run_query "\dt"
    ;;
  
  "users")
    echo "👥 All users..."
    run_query "SELECT id, email, role, is_active, created_at FROM users ORDER BY created_at DESC;"
    ;;
  
  "companies")
    echo "🏢 All companies..."
    run_query "SELECT id, name, domain, is_active, created_at FROM companies ORDER BY created_at DESC;"
    ;;
  
  "subscriptions")
    echo "💳 All subscriptions..."
    run_query "SELECT id, user_id, company_id, status, is_custom, created_at FROM customer_subscriptions ORDER BY created_at DESC;"
    ;;
  
  "provisioned")
    echo "🎯 Provisioned customers..."
    run_query "SELECT cs.id as sub_id, c.name as company, u.email as admin_email, cs.status, cs.created_at FROM customer_subscriptions cs JOIN companies c ON cs.company_id = c.id JOIN users u ON cs.user_id = u.id WHERE cs.is_custom = true ORDER BY cs.created_at DESC;"
    ;;
  
  "admin")
    echo "👑 Admin users..."
    run_query "SELECT id, email, first_name, last_name, role, is_active FROM users WHERE role = 'admin';"
    ;;
  
  "inactive")
    echo "🚫 Inactive users and companies..."
    echo ""
    echo "Inactive Users:"
    run_query "SELECT id, email, role, is_active FROM users WHERE is_active = false;"
    echo ""
    echo "Inactive Companies:"
    run_query "SELECT id, name, is_active FROM companies WHERE is_active = false;"
    ;;
  
  "schema")
    TABLE="$2"
    if [ -z "$TABLE" ]; then
      echo "Usage: ./scripts/db-common-queries.sh schema [table_name]"
      echo "Example: ./scripts/db-common-queries.sh schema users"
      exit 1
    fi
    echo "📐 Schema for table: $TABLE"
    run_query "\d $TABLE"
    ;;
  
  "count")
    echo "📊 Record counts..."
    run_query "SELECT 'users' as table_name, COUNT(*) as count FROM users UNION ALL SELECT 'companies', COUNT(*) FROM companies UNION ALL SELECT 'customer_subscriptions', COUNT(*) FROM customer_subscriptions UNION ALL SELECT 'tickets', COUNT(*) FROM tickets;"
    ;;
  
  "fix-suspended")
    echo "🔧 Finding suspended customers..."
    run_query "SELECT cs.id as subscription_id, c.id as company_id, c.name as company_name, cs.status FROM customer_subscriptions cs JOIN companies c ON cs.company_id = c.id WHERE cs.status = 'suspended';"
    ;;
  
  *)
    echo "🗄️  Database Common Queries"
    echo ""
    echo "Usage: ./scripts/db-common-queries.sh [command]"
    echo ""
    echo "Available commands:"
    echo "  tables          - List all tables"
    echo "  users           - Show all users"
    echo "  companies       - Show all companies"
    echo "  subscriptions   - Show all subscriptions"
    echo "  provisioned     - Show provisioned customers"
    echo "  admin           - Show admin users"
    echo "  inactive        - Show inactive users and companies"
    echo "  schema [table]  - Show table schema"
    echo "  count           - Show record counts"
    echo "  fix-suspended   - Find suspended customers"
    echo ""
    echo "Examples:"
    echo "  ./scripts/db-common-queries.sh users"
    echo "  ./scripts/db-common-queries.sh schema users"
    echo "  ./scripts/db-common-queries.sh provisioned"
    ;;
esac
