import os
import sys
import django
import datetime

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_project.settings')
django.setup()

from attendance_api.models import Student, AttendanceSession
from attendance_api.utils import generate_qr_code, send_student_qr_email

def seed_10_students():
    print("🌱 Seeding ~10 Dummy Students for System Testing...\n")

    today = datetime.date.today()
    session_obj = AttendanceSession.objects.filter(title='DAA Lecture - 6 Sept').first()
    if not session_obj:
        session_obj = AttendanceSession.objects.create(title='DAA Lecture - 6 Sept', date=today, is_active=True)
    
    print(f"📌 Active Attendance Session: {session_obj.title} (ID: {session_obj.id})\n")

    dummy_students = [
        {'name': 'Alex Rivera', 'email': 'alex.rivera@university.edu', 'branch': 'Computer Science', 'year': '3', 'section': 'A'},
        {'name': 'Sophia Chen', 'email': 'sophia.chen@university.edu', 'branch': 'Information Technology', 'year': '2', 'section': 'B'},
        {'name': 'Marcus Johnson', 'email': 'marcus.j@university.edu', 'branch': 'Electronics', 'year': '4', 'section': 'A'},
        {'name': 'Emma Watson', 'email': 'emma.w@university.edu', 'branch': 'Data Science', 'year': '1', 'section': 'C'},
        {'name': 'Liam Hemsworth', 'email': 'liam.h@university.edu', 'branch': 'Mechanical', 'year': '3', 'section': 'B'},
        {'name': 'Olivia Rodrigo', 'email': 'olivia.r@university.edu', 'branch': 'Computer Science', 'year': '2', 'section': 'A'},
        {'name': 'Noah Centineo', 'email': 'noah.c@university.edu', 'branch': 'Information Technology', 'year': '4', 'section': 'C'},
        {'name': 'Ava DuVernay', 'email': 'ava.d@university.edu', 'branch': 'Data Science', 'year': '1', 'section': 'A'},
        {'name': 'Ethan Hawke', 'email': 'ethan.h@university.edu', 'branch': 'Electronics', 'year': '3', 'section': 'B'},
        {'name': 'Isabella Rossellini', 'email': 'isabella.r@university.edu', 'branch': 'Mechanical', 'year': '2', 'section': 'A'},
    ]

    added_count = 0
    for s_data in dummy_students:
        student = Student.objects.filter(email=s_data['email']).first()
        if not student:
            student = Student.objects.create(**s_data)
            file_content, _ = generate_qr_code(student.unique_token)
            student.qr_code_image.save(f"qr_{student.unique_token}.png", file_content, save=True)
            send_student_qr_email(student)
            added_count += 1
            print(f"   ➕ Added: {student.name} | Email: {student.email} | UUID Token: {student.unique_token}")
        else:
            print(f"   ℹ️ Existing: {student.name} | UUID Token: {student.unique_token}")

    print(f"\n🎉 Successfully processed seed data! Total students in database: {Student.objects.count()}")

if __name__ == '__main__':
    seed_10_students()
