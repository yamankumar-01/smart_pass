# ==========================================
# Production Python Django Backend Container
# (Frontend is hosted separately on Vercel)
# ==========================================
FROM python:3.11-slim

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

# Copy entrypoint startup script
COPY start.sh ./
RUN chmod +x ./start.sh

EXPOSE 8000

CMD ["./start.sh"]

