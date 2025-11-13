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

# Start with ts-node
CMD ["npx", "ts-node", "src/index.ts"]
