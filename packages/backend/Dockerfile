FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for ts-node)
RUN npm install

# Copy source code
COPY . .

# Create startup script - migrations are optional, server must start
RUN echo '#!/bin/sh\n\
echo "Attempting database migrations..."\n\
timeout 30 npx knex migrate:latest --knexfile knexfile.js --env production || echo "⚠️ Migrations skipped (will retry on next deploy)"\n\
echo "Starting server..."\n\
exec npx ts-node --transpile-only -r tsconfig-paths/register src/index.ts' > /app/start.sh && chmod +x /app/start.sh

# Start with migrations then server
CMD ["/app/start.sh"]
