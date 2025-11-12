#!/bin/bash
# Quick database query script
# Usage: ./scripts/db-query.sh "SELECT * FROM users LIMIT 5;"

QUERY="$1"

if [ -z "$QUERY" ]; then
  echo "Usage: ./scripts/db-query.sh \"YOUR SQL QUERY\""
  echo "Example: ./scripts/db-query.sh \"SELECT * FROM users LIMIT 5;\""
  exit 1
fi

docker exec -it bomizzel-postgres psql -U bomizzel_user -d bomizzel_db -c "$QUERY"
