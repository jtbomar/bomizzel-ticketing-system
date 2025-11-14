FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for ts-node)
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Start with ts-node and tsconfig-paths
CMD ["npx", "ts-node", "-r", "tsconfig-paths/register", "src/index.ts"]
