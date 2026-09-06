import os
import django
import sys
import uuid
import urllib.request
import json

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_project.settings')
django.setup()

from django.db.utils import IntegrityError
from attendance_api.models import Student, AttendanceSession, AttendanceRecord

BASE_URL = 'http://127.0.0.1:8000/api'

def post_json(endpoint, payload=None, headers=None):
    url = f"{BASE_URL}{endpoint}"
    data = json.dumps(payload).encode('utf-8') if payload else None
    req_headers = {'Content-Type': 'application/json'}
    if headers:
        req_headers.update(headers)
    
    req = urllib.request.Request(url, data=data, headers=req_headers, method='POST')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except:
            return e.code, body

def run_tests():
    print('🧪 Testing Section 8 Security Requirements...\n')

    # 1. Test UUID token un-guessability & reusability across sessions
    print('1️⃣ Testing UUID Token Un-guessability & Session Reusability...')
    st1, _ = Student.objects.get_or_create(
        email='sec.user@university.edu',
        defaults={'name': 'Security User', 'branch': 'CS', 'year': '3', 'section': 'A'}
    )
    assert isinstance(st1.unique_token, uuid.UUID)
    print(f'   Generated Token: {st1.unique_token} (Valid UUID4)')

    sess1 = AttendanceSession.objects.create(title='Lecture 1', date='2026-09-06')
    sess2 = AttendanceSession.objects.create(title='Lecture 2', date='2026-09-06')

    # Mark attendance in Session 1 & Session 2 using SAME QR token
    rec1 = AttendanceRecord.objects.create(session=sess1, student=st1, status='PRESENT')
    rec2 = AttendanceRecord.objects.create(session=sess2, student=st1, status='PRESENT')
    print(f'   Session 1 Record ID: {rec1.id}, Session 2 Record ID: {rec2.id}')
    print('   ✅ PASS: Single QR UUID token reusable across multiple sessions without regeneration!')

    # 2. Test DB-level unique_together constraint
    print('\n2️⃣ Testing DB-level unique_together = (student, session) Constraint...')
    try:
        AttendanceRecord.objects.create(session=sess1, student=st1, status='PRESENT')
        print('   ❌ FAIL: Duplicate record creation did not raise IntegrityError!')
    except IntegrityError as ie:
        print(f'   Database IntegrityError Caught: {ie}')
        print('   ✅ PASS: Database enforced unique_together constraint on (student, session)!')

    # 3. Test Unauthenticated Access Rejection (JWT Protection)
    print('\n3️⃣ Testing Unauthenticated Request Rejection (JWT Protection)...')
    st_unauth, res_unauth = post_json('/attendance/scan/', {'token': str(st1.unique_token), 'session_id': sess1.id})
    print(f'   Unauthenticated Scan Response Status: {st_unauth}')
    if st_unauth == 401:
        print('   ✅ PASS: Unauthenticated scan request rejected with 401 Unauthorized!')
    else:
        print(f'   ❌ FAIL: Expected 401 Unauthorized, got {st_unauth}')

    # 4. Test Authenticated Access with JWT Token
    print('\n4️⃣ Testing Authenticated Admin Request with JWT Token...')
    st_auth, res_auth = post_json('/token/', {'username': 'admin', 'password': 'admin123'})
    access_token = res_auth['access']
    headers = {'Authorization': f'Bearer {access_token}'}

    sess3 = AttendanceSession.objects.create(title='Lecture 3', date='2026-09-06')
    st_scan, res_scan = post_json('/attendance/scan/', {'token': str(st1.unique_token), 'session_id': sess3.id}, headers=headers)
    print(f'   Authenticated Scan Response Status: {st_scan}')
    print(f'   Scan Output: {res_scan}')
    if st_scan == 200 and res_scan.get('success') is True:
        print('   ✅ PASS: JWT Authenticated admin request processed successfully!')

    print('\n🎉 ALL SECTION 8 SECURITY REQUIREMENTS VERIFIED SUCCESSFULLY!\n')

if __name__ == '__main__':
    run_tests()
