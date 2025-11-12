#!/bin/bash
# Database fix scripts for common issues
# Usage: ./scripts/db-fix.sh [command] [args]

CONTAINER="bomizzel-postgres"
DB_USER="bomizzel_user"
DB_NAME="bomizzel_db"

function run_query() {
  docker exec -it $CONTAINER psql -U $DB_USER -d $DB_NAME -c "$1"
}

case "$1" in
  "enable-user")
    USER_EMAIL="$2"
    if [ -z "$USER_EMAIL" ]; then
      echo "Usage: ./scripts/db-fix.sh enable-user [email]"
      exit 1
    fi
    echo "✅ Enabling user: $USER_EMAIL"
    run_query "UPDATE users SET is_active = true WHERE email = '$USER_EMAIL';"
    ;;
  
  "disable-user")
    USER_EMAIL="$2"
    if [ -z "$USER_EMAIL" ]; then
      echo "Usage: ./scripts/db-fix.sh disable-user [email]"
      exit 1
    fi
    echo "🚫 Disabling user: $USER_EMAIL"
    run_query "UPDATE users SET is_active = false WHERE email = '$USER_EMAIL';"
    ;;
  
  "enable-company")
    COMPANY_ID="$2"
    if [ -z "$COMPANY_ID" ]; then
      echo "Usage: ./scripts/db-fix.sh enable-company [company_id]"
      exit 1
    fi
    echo "✅ Enabling company: $COMPANY_ID"
    run_query "UPDATE companies SET is_active = true WHERE id = '$COMPANY_ID';"
    ;;
  
  "disable-company")
    COMPANY_ID="$2"
    if [ -z "$COMPANY_ID" ]; then
      echo "Usage: ./scripts/db-fix.sh disable-company [company_id]"
      exit 1
    fi
    echo "🚫 Disabling company: $COMPANY_ID"
    run_query "UPDATE companies SET is_active = false WHERE id = '$COMPANY_ID';"
    ;;
  
  "activate-subscription")
    SUB_ID="$2"
    if [ -z "$SUB_ID" ]; then
      echo "Usage: ./scripts/db-fix.sh activate-subscription [subscription_id]"
      exit 1
    fi
    echo "✅ Activating subscription: $SUB_ID"
    run_query "UPDATE customer_subscriptions SET status = 'active' WHERE id = '$SUB_ID';"
    ;;
  
  "suspend-subscription")
    SUB_ID="$2"
    if [ -z "$SUB_ID" ]; then
      echo "Usage: ./scripts/db-fix.sh suspend-subscription [subscription_id]"
      exit 1
    fi
    echo "⏸️  Suspending subscription: $SUB_ID"
    run_query "UPDATE customer_subscriptions SET status = 'suspended' WHERE id = '$SUB_ID';"
    ;;
  
  "reset-admin-password")
    ADMIN_EMAIL="$2"
    NEW_PASSWORD="$3"
    if [ -z "$ADMIN_EMAIL" ] || [ -z "$NEW_PASSWORD" ]; then
      echo "Usage: ./scripts/db-fix.sh reset-admin-password [email] [new_password]"
      exit 1
    fi
    # Hash the password using bcrypt (requires bcrypt to be installed)
    echo "🔐 Resetting password for: $ADMIN_EMAIL"
    echo "Note: You'll need to hash the password manually or use the API"
    echo "For now, showing the user record:"
    run_query "SELECT id, email, role FROM users WHERE email = '$ADMIN_EMAIL';"
    ;;
  
  "make-admin")
    USER_EMAIL="$2"
    if [ -z "$USER_EMAIL" ]; then
      echo "Usage: ./scripts/db-fix.sh make-admin [email]"
      exit 1
    fi
    echo "👑 Making user admin: $USER_EMAIL"
    run_query "UPDATE users SET role = 'admin' WHERE email = '$USER_EMAIL';"
    ;;
  
  "verify-email")
    USER_EMAIL="$2"
    if [ -z "$USER_EMAIL" ]; then
      echo "Usage: ./scripts/db-fix.sh verify-email [email]"
      exit 1
    fi
    echo "✉️  Verifying email: $USER_EMAIL"
    run_query "UPDATE users SET email_verified = true WHERE email = '$USER_EMAIL';"
    ;;
  
  "enable-all-company-users")
    COMPANY_ID="$2"
    if [ -z "$COMPANY_ID" ]; then
      echo "Usage: ./scripts/db-fix.sh enable-all-company-users [company_id]"
      exit 1
    fi
    echo "✅ Enabling all users in company: $COMPANY_ID"
    run_query "UPDATE users SET is_active = true WHERE id IN (SELECT user_id FROM user_company_associations WHERE company_id = '$COMPANY_ID');"
    ;;
  
  "disable-all-company-users")
    COMPANY_ID="$2"
    if [ -z "$COMPANY_ID" ]; then
      echo "Usage: ./scripts/db-fix.sh disable-all-company-users [company_id]"
      exit 1
    fi
    echo "🚫 Disabling all users in company: $COMPANY_ID"
    run_query "UPDATE users SET is_active = false WHERE id IN (SELECT user_id FROM user_company_associations WHERE company_id = '$COMPANY_ID');"
    ;;
  
  *)
    echo "🔧 Database Fix Scripts"
    echo ""
    echo "Usage: ./scripts/db-fix.sh [command] [args]"
    echo ""
    echo "User Commands:"
    echo "  enable-user [email]                    - Enable a user account"
    echo "  disable-user [email]                   - Disable a user account"
    echo "  make-admin [email]                     - Make user an admin"
    echo "  verify-email [email]                   - Mark email as verified"
    echo ""
    echo "Company Commands:"
    echo "  enable-company [company_id]            - Enable a company"
    echo "  disable-company [company_id]           - Disable a company"
    echo "  enable-all-company-users [company_id]  - Enable all users in company"
    echo "  disable-all-company-users [company_id] - Disable all users in company"
    echo ""
    echo "Subscription Commands:"
    echo "  activate-subscription [sub_id]         - Activate a subscription"
    echo "  suspend-subscription [sub_id]          - Suspend a subscription"
    echo ""
    echo "Examples:"
    echo "  ./scripts/db-fix.sh enable-user admin@bomizzel.com"
    echo "  ./scripts/db-fix.sh make-admin user@example.com"
    echo "  ./scripts/db-fix.sh activate-subscription abc-123-def"
    ;;
esac
