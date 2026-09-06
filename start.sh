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

username = os.getenv('DJANGO_SUPERUSER_USERNAME', 'smartpass')
email = os.getenv('DJANGO_SUPERUSER_EMAIL', 'smartpass@example.com')
password = os.getenv('DJANGO_SUPERUSER_PASSWORD', 'src@2019')

user = User.objects.filter(username=username).first()
if not user:
    User.objects.create_superuser(username=username, email=email, password=password)
    print(f'==> Created default admin superuser: {username}')
else:
    user.set_password(password)
    user.save()
    print(f'==> Updated/Verified admin superuser: {username}')
"

echo "==> Checking and seeding initial student and event records..."
python backend/manage.py shell -c "
from attendance_api.models import Student
from django.core.management import call_command
import os

if Student.objects.count() == 0 and os.path.exists('backend/seed_data.json'):
    try:
        print('==> Seeding initial students and events from seed_data.json...')
        call_command('loaddata', 'backend/seed_data.json')
        print(f'==> Successfully seeded {Student.objects.count()} students!')
    except Exception as e:
        print(f'==> Seed note: {e}')
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
