# ==========================================
# Multi-Stage Production Dockerfile
# Stage 1: Build the React Vite Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/client

COPY client/package*.json ./
RUN npm install

COPY client/ ./
RUN npm run build

# ==========================================
# Stage 2: Production Python Django Container
# ==========================================
FROM python:3.11-slim AS backend-runner

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy Django backend application
COPY backend/ ./backend/

# Copy compiled React frontend assets from Stage 1
COPY --from=frontend-builder /app/client/dist ./client/dist

# Copy entrypoint startup script
COPY start.sh ./
RUN chmod +x ./start.sh

EXPOSE 8000

CMD ["./start.sh"]
