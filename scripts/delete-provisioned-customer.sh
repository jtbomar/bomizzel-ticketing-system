#!/bin/bash
# Delete a provisioned customer by company name
# Usage: ./scripts/delete-provisioned-customer.sh "Company Name"

CONTAINER="bomizzel-postgres"
DB_USER="bomizzel_user"
DB_NAME="bomizzel_db"

COMPANY_NAME="$1"

if [ -z "$COMPANY_NAME" ]; then
  echo "❌ Error: Company name required"
  echo ""
  echo "Usage: ./scripts/delete-provisioned-customer.sh \"Company Name\""
  echo ""
  echo "Available provisioned customers:"
  docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -c "SELECT c.name, c.id FROM companies c JOIN customer_subscriptions cs ON c.id = cs.company_id WHERE cs.is_custom = true;"
  exit 1
fi

echo "⚠️  WARNING: This will permanently delete the company and all associated data!"
echo "Company: $COMPANY_NAME"
echo ""
read -p "Are you sure? Type 'DELETE' to confirm: " CONFIRM

if [ "$CONFIRM" != "DELETE" ]; then
  echo "❌ Deletion cancelled"
  exit 0
fi

echo ""
echo "🔍 Finding company..."

# Get company ID
COMPANY_ID=$(docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "SELECT id FROM companies WHERE name = '$COMPANY_NAME';")

if [ -z "$COMPANY_ID" ]; then
  echo "❌ Company not found: $COMPANY_NAME"
  exit 1
fi

COMPANY_ID=$(echo $COMPANY_ID | tr -d ' ')
echo "Found company ID: $COMPANY_ID"

echo ""
echo "🗑️  Deleting subscriptions..."
docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -c "DELETE FROM customer_subscriptions WHERE company_id = '$COMPANY_ID';"

echo ""
echo "🗑️  Deleting company..."
docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -c "DELETE FROM companies WHERE id = '$COMPANY_ID';"

echo ""
echo "✅ Company deleted successfully!"
echo ""
echo "Remaining provisioned customers:"
docker exec $CONTAINER psql -U $DB_USER -d $DB_NAME -c "SELECT c.name FROM companies c JOIN customer_subscriptions cs ON c.id = cs.company_id WHERE cs.is_custom = true;"
