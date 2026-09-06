import django
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'attendance_project.settings')
django.setup()

from attendance_api.models import Student
from django.db import connection

# Fetch all existing students
students = list(Student.objects.all().order_by('id'))
print(f"Current students count: {len(students)}")

# Delete and reset sequence
Student.objects.all().delete()
with connection.cursor() as cursor:
    try:
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='attendance_api_student'")
    except Exception as e:
        print("Sequence reset note:", e)

# Re-insert with clean autoincrement from 1
to_create = []
for st in students:
    to_create.append(Student(
        name=st.name,
        email=st.email,
        branch=st.branch,
        year=st.year,
        section=st.section,
        unique_token=st.unique_token,
        qr_sent=st.qr_sent
    ))

Student.objects.bulk_create(to_create)

print(f"Successfully re-sequenced {Student.objects.count()} students!")
first_5 = list(Student.objects.values_list('id', 'name')[:5])
print("First 5 students with reset IDs:", first_5)
