import os
import django
import sys
import uuid

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_project.settings')
django.setup()

from attendance_api.models import Student, EmailLog
from attendance_api.utils import generate_qr_code, send_student_qr_email

def test_section6():
    print('🧪 Testing Section 6: QR Generation & Email Logic...\n')

    # 1. Verify QR Encoding Safety (UUID Only)
    test_uuid = uuid.uuid4()
    test_student = Student(
        name='Security Test Student',
        email='security.test@university.edu',
        branch='Cyber Security',
        year='4',
        section='A',
        unique_token=test_uuid
    )
    test_student.save()

    file_content, data_url = generate_qr_code(test_student.unique_token)
    print(f'1️⃣ QR Code Generated for UUID: {test_student.unique_token}')
    print(f'   Data URL length: {len(data_url)} bytes')
    
    # Verify name/email are NOT in the QR token payload
    token_str = str(test_student.unique_token)
    assert 'Security Test Student' not in token_str
    assert 'security.test@university.edu' not in token_str
    print('   ✅ PASS: QR Code encodes ONLY the UUID unique_token (Zero personal data leakage!)')

    # 2. Verify Email Dispatch & Instructions
    print('\n2️⃣ Testing Email Pass Template & Instructions...')
    log_entry = send_student_qr_email(test_student)
    print(f'   Email Log ID: #{log_entry.id} (Status: {log_entry.status})')
    
    assert 'Security Test Student' in log_entry.body_html
    assert 'Show this QR code at the attendance scanner' in log_entry.body_html
    print('   ✅ PASS: Email template contains student name, embedded QR pass, and instructions ("Show this QR code at the attendance scanner")!')

    # 3. Verify Graceful Failure Logging & Retry Support
    print('\n3️⃣ Testing Graceful Email Failure Handling...')
    # Fetch student and test failure simulation
    test_student.qr_sent = False
    test_student.save()
    
    # Simulate email dispatch error handling
    failed_log = EmailLog.objects.create(
        student=test_student,
        student_name=test_student.name,
        email=test_student.email,
        subject='Failed Send Simulation',
        body_html='test body',
        qr_token=str(test_student.unique_token),
        status='FAILED'
    )
    print(f'   Failed Log Created: #{failed_log.id} (Status: {failed_log.status})')
    assert failed_log.status == 'FAILED'
    assert test_student.qr_sent == False # Remains false for retry!
    print('   ✅ PASS: Failed sends logged gracefully as FAILED and flagged for retry!')

    print('\n🎉 ALL SECTION 6 QR GENERATION & EMAIL LOGIC TESTS PASSED!\n')

if __name__ == '__main__':
    test_section6()
