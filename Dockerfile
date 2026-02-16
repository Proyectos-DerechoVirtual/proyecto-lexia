# Build stage for frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Build stage for backend
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app

# Copy backend
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/package*.json ./backend/
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Install serve for frontend
RUN npm install -g serve

# Expose ports
EXPOSE 8000 4000

# Start script
COPY <<EOF start.sh
#!/bin/sh
# Start backend
cd /app/backend && npm run start:supabase &

# Start frontend
serve -s /app/frontend/dist -l 4000 &

# Wait for any process to exit
wait -n
EOF

RUN chmod +x start.sh

CMD ["./start.sh"]