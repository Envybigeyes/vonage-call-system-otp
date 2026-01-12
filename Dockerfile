FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install backend
WORKDIR /app/backend
RUN npm cache clean --force && \
    npm install ajv@^8.12.0 --save && \
    npm install --legacy-peer-deps

# Install frontend
WORKDIR /app/frontend
RUN npm cache clean --force && \
    npm install ajv@^8.12.0 --save && \
    npm install --legacy-peer-deps

# Copy ALL source files INCLUDING private.key
WORKDIR /app
COPY . .

# Verify private.key exists in the image
RUN ls -la backend/private.key || echo "WARNING: private.key not found"

# Build frontend
WORKDIR /app/frontend
RUN npm run build

WORKDIR /app
EXPOSE 8080
CMD ["node", "backend/server.js"]
