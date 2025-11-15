FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for ts-node)
RUN npm install

# Copy source code
COPY . .

# Create startup script
RUN echo '#!/bin/sh\n\
echo "Running database migrations..."\n\
npx knex migrate:latest --knexfile knexfile.js\n\
echo "Running database seeds..."\n\
npx knex seed:run --knexfile knexfile.js\n\
echo "Starting server..."\n\
npx ts-node --transpile-only -r tsconfig-paths/register src/index.ts' > /app/start.sh && chmod +x /app/start.sh

# Start with migrations then server
CMD ["/app/start.sh"]
