# Minimal Dockerfile for Node.js Express dashboard (no GUI/Chromium)
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
