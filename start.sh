#!/bin/sh
set -e

echo "==> Running database migrations..."
python backend/manage.py migrate --noinput

echo "==> Collecting static files..."
python backend/manage.py collectstatic --noinput

echo "==> Ensuring default users exist..."
python backend/manage.py shell -c "
from django.contrib.auth.models import User

# 1. Admin user (superuser) - username: yamankumar
admin_user = User.objects.filter(username='yamankumar').first()
if not admin_user:
    User.objects.create_superuser(username='yamankumar', email='yamankumarkne2026@gmail.com', password='src@2019')
    print('==> Created admin superuser: yamankumar')
else:
    admin_user.email = 'yamankumarkne2026@gmail.com'
    admin_user.set_password('src@2019')
    admin_user.is_staff = True
    admin_user.is_superuser = True
    admin_user.save()
    print('==> Verified admin superuser: yamankumar')

# 2. Volunteer user (regular) - username: userscan
vol_user = User.objects.filter(username='userscan').first()
if not vol_user:
    User.objects.create_user(username='userscan', email='volunteer@smartpass.app', password='src@2019')
    print('==> Created volunteer user: userscan')
else:
    vol_user.set_password('src@2019')
    vol_user.is_staff = False
    vol_user.is_superuser = False
    vol_user.save()
    print('==> Verified volunteer user: userscan')

# 3. Clean up old accounts
User.objects.filter(username__in=['adminpass', 'smartpass']).delete()
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
