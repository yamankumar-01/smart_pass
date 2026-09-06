#!/bin/sh
set -e

echo "==> Running database migrations..."
python backend/manage.py migrate --noinput

echo "==> Collecting static files..."
python backend/manage.py collectstatic --noinput

echo "==> Ensuring default admin superuser exists..."
python backend/manage.py shell -c "
from django.contrib.auth.models import User
import os

username = os.getenv('DJANGO_SUPERUSER_USERNAME', 'admin')
email = os.getenv('DJANGO_SUPERUSER_EMAIL', 'admin@example.com')
password = os.getenv('DJANGO_SUPERUSER_PASSWORD', 'admin123')

user = User.objects.filter(username=username).first()
if not user:
    User.objects.create_superuser(username=username, email=email, password=password)
    print(f'==> Created default admin superuser: {username}')
else:
    user.set_password(password)
    user.save()
    print(f'==> Updated/Verified admin superuser: {username}')
"

PORT="${PORT:-8000}"
echo "==> Starting Gunicorn on port $PORT..."
exec gunicorn attendance_project.wsgi:application \
    --chdir backend \
    --bind "0.0.0.0:${PORT}" \
    --workers 3 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
