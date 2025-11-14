FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for ts-node)
RUN npm install

# Copy source code
COPY . .

# Start with migrations then server
CMD ["sh", "-c", "npx knex migrate:latest --knexfile knexfile.js && npx knex seed:run --knexfile knexfile.js && npx ts-node -r tsconfig-paths/register src/index.ts"]
