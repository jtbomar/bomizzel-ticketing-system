#!/bin/bash
# Open interactive PostgreSQL shell
# Usage: ./scripts/db-shell.sh

echo "Opening PostgreSQL shell..."
echo "Database: bomizzel_db"
echo "User: bomizzel_user"
echo ""
echo "Useful commands:"
echo "  \\dt              - List all tables"
echo "  \\d table_name    - Describe table structure"
echo "  \\q               - Quit"
echo ""

docker exec -it bomizzel-postgres psql -U bomizzel_user -d bomizzel_db
