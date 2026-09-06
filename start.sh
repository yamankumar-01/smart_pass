#!/bin/sh
set -e

echo "==> Running database migrations..."
python backend/manage.py migrate --noinput

echo "==> Collecting static files..."
python backend/manage.py collectstatic --noinput

echo "==> Ensuring default users exist..."
python backend/manage.py shell -c "
from django.contrib.auth.models import User

# 1. Admin user (superuser) - username: adminpass
admin_user = User.objects.filter(username='adminpass').first()
if not admin_user:
    User.objects.create_superuser(username='adminpass', email='admin@smartpass.app', password='src@2019')
    print('==> Created admin superuser: adminpass')
else:
    admin_user.set_password('src@2019')
    admin_user.is_staff = True
    admin_user.is_superuser = True
    admin_user.save()
    print('==> Verified admin superuser: adminpass')

# 2. Volunteer user (regular) - username: smartpass
vol_user = User.objects.filter(username='smartpass').first()
if not vol_user:
    User.objects.create_user(username='smartpass', email='volunteer@smartpass.app', password='src@2019')
    print('==> Created volunteer user: smartpass')
else:
    vol_user.set_password('src@2019')
    vol_user.is_staff = False
    vol_user.is_superuser = False
    vol_user.save()
    print('==> Verified volunteer user: smartpass')
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
