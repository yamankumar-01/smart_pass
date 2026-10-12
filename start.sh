#!/bin/sh
set -e

echo "==> Running database migrations..."
python backend/manage.py migrate --noinput

echo "==> Collecting static files..."
python backend/manage.py collectstatic --noinput

echo "==> Ensuring default users exist..."
python backend/manage.py shell -c "
import os
from django.contrib.auth.models import User

admin_u = os.getenv('ADMIN_USERNAME')
admin_e = os.getenv('ADMIN_EMAIL')
admin_p = os.getenv('ADMIN_PASSWORD')

vol_u = os.getenv('VOL_USERNAME')
vol_e = os.getenv('VOL_EMAIL', 'volunteer@smartpass.app')
vol_p = os.getenv('VOL_PASSWORD')

# 1. Ensure admin superuser exists
admin_user = User.objects.filter(is_superuser=True).first()
if not admin_user:
    if admin_u and admin_p:
        User.objects.create_superuser(username=admin_u, email=admin_e or 'admin@smartpass.app', password=admin_p)
        print(f'==> Created admin superuser: {admin_u}')
    else:
        print('==> Warning: No superuser found and ADMIN_USERNAME/ADMIN_PASSWORD not set in environment.')
else:
    if admin_p:
        admin_user.set_password(admin_p)
        admin_user.save()
        print('==> Admin superuser password updated from environment.')
    print('==> Admin superuser verified.')

# 2. Ensure volunteer scanner account exists
if vol_u and vol_p:
    vol_user = User.objects.filter(username=vol_u).first()
    if not vol_user:
        User.objects.create_user(username=vol_u, email=vol_e, password=vol_p)
        print(f'==> Created volunteer user: {vol_u}')
    else:
        vol_user.set_password(vol_p)
        vol_user.is_staff = False
        vol_user.is_superuser = False
        vol_user.save()
        print(f'==> Volunteer user verified: {vol_u}')
else:
    print('==> Volunteer user check complete.')

# 3. Clean up obsolete placeholder accounts
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
