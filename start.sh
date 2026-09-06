#!/bin/sh
set -e

echo "==> Running database migrations..."
python backend/manage.py migrate --noinput

echo "==> Collecting static files..."
python backend/manage.py collectstatic --noinput

PORT="${PORT:-8000}"
echo "==> Starting Gunicorn on port $PORT..."
exec gunicorn attendance_project.wsgi:application \
    --chdir backend \
    --bind "0.0.0.0:${PORT}" \
    --workers 3 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
