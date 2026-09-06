import csv
import io
import datetime
import uuid
from concurrent.futures import ThreadPoolExecutor
from django.http import HttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.throttling import ScopedRateThrottle, UserRateThrottle, AnonRateThrottle

from .models import Student, AttendanceSession, AttendanceRecord, EmailLog, SMTPSetting, Event, EventPass
from .serializers import (
    StudentSerializer, 
    AttendanceSessionSerializer, 
    AttendanceRecordSerializer, 
    EmailLogSerializer,
    SMTPSettingSerializer,
    ScanInputSerializer,
    EventSerializer,
    EventPassSerializer
)
from .utils import generate_qr_code, send_student_qr_email, send_event_qr_email, send_batch_event_qr_emails

@api_view(['GET'])
@permission_classes([AllowAny])
def current_user_view(request):
    if request.user and request.user.is_authenticated:
        return Response({
            'username': request.user.username,
            'email': request.user.email,
            'is_staff': request.user.is_staff
        })
    return Response({'username': 'Anonymous', 'is_authenticated': False})

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all().order_by('id')
    serializer_class = StudentSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search', None)
        branch = self.request.query_params.get('branch', None)
        year = self.request.query_params.get('year', None)
        section = self.request.query_params.get('section', None)

        if search:
            qs = qs.filter(name__icontains=search) | qs.filter(email__icontains=search) | qs.filter(unique_token__icontains=search)
        if branch:
            qs = qs.filter(branch=branch)
        if year:
            qs = qs.filter(year=year)
        if section:
            qs = qs.filter(section=section)
        return qs

    def perform_create(self, serializer):
        student = serializer.save()
        file_content, _ = generate_qr_code(student.unique_token)
        student.qr_code_image.save(f"qr_{student.unique_token}.png", file_content, save=True)
        send_student_qr_email(student)

    @action(detail=False, methods=['post'], url_path='upload')
    def upload(self, request):
        return bulk_upload_csv_view(request)

    @action(detail=False, methods=['post'], url_path='generate-qr')
    def generate_qr(self, request):
        return bulk_generate_qr_view(request)

    @action(detail=False, methods=['post'], url_path='send-emails')
    def send_emails(self, request):
        return bulk_send_emails_view(request)

    @action(detail=True, methods=['post'])
    def resend_email(self, request, pk=None):
        student = self.get_object()
        log = send_student_qr_email(student)
        return Response({'message': f'QR Email sent to {student.email}', 'log_id': log.id, 'status': log.status, 'error': log.error_message})

    @action(detail=False, methods=['delete', 'post'], url_path='clear-all')
    def clear_all(self, request):
        count = Student.objects.count()
        Student.objects.all().delete()
        try:
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("DELETE FROM sqlite_sequence WHERE name='attendance_api_student'")
        except Exception:
            pass
        return Response({'message': f'Successfully deleted all {count} students.', 'deleted_count': count})

    @action(detail=False, methods=['post'], url_path='resolve-duplicates')
    def resolve_duplicates(self, request):
        action_type = request.data.get('action') # 'overwrite_all', 'overwrite_selected', 'delete_selected'
        duplicates = request.data.get('duplicates', [])
        
        updated_count = 0
        deleted_count = 0
        
        if action_type in ['overwrite_all', 'overwrite_selected']:
            for item in duplicates:
                email = item.get('email', '').strip().lower()
                if not email:
                    continue
                student = Student.objects.filter(email=email).first()
                if student:
                    if item.get('name'):
                        student.name = item['name']
                    if item.get('branch'):
                        student.branch = item['branch']
                    if item.get('year'):
                        student.year = str(item['year'])
                    if item.get('section'):
                        student.section = str(item['section'])
                    student.save()
                    updated_count += 1
            return Response({'message': f'Successfully updated {updated_count} student record(s) in the database.', 'updated_count': updated_count})
            
        elif action_type == 'delete_selected':
            emails = [item.get('email', '').strip().lower() for item in duplicates if item.get('email')]
            deleted_count = Student.objects.filter(email__in=emails).delete()[0]
            return Response({'message': f'Successfully removed {deleted_count} student record(s) from database.', 'deleted_count': deleted_count})

        return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def bulk_upload_csv_view(request):
    import re
    import openpyxl
    file_obj = request.FILES.get('file', None)
    if not file_obj:
        return Response({'error': 'No file uploaded. Please upload a .csv or .xlsx / .xls file.'}, status=status.HTTP_400_BAD_REQUEST)

    filename = getattr(file_obj, 'name', '').lower()
    raw_bytes = file_obj.read()
    rows = []

    # 1. Parse Excel files (.xlsx, .xlsm, .xltx)
    if filename.endswith(('.xlsx', '.xlsm', '.xltx', '.xls')):
        try:
            wb = openpyxl.load_workbook(io.BytesIO(raw_bytes), data_only=True)
            active_sheet = wb.active
            for r in active_sheet.iter_rows(values_only=True):
                if r and any(cell is not None and str(cell).strip() for cell in r):
                    rows.append([str(c).strip() if c is not None else '' for c in r])
        except Exception as excel_err:
            # Fallback to CSV decoding if openpyxl fails (e.g. if CSV was renamed to .xls)
            pass

    # 2. Parse CSV / Text files
    if not rows:
        decoded_file = None
        for enc in ['utf-8-sig', 'utf-8', 'latin-1', 'cp1252', 'iso-8859-1']:
            try:
                decoded_file = raw_bytes.decode(enc)
                break
            except UnicodeDecodeError:
                continue

        if not decoded_file:
            return Response({'error': 'Could not decode file. Please upload a standard CSV or Excel (.xlsx) file.'}, status=status.HTTP_400_BAD_REQUEST)

        # Detect delimiter (comma, semicolon, tab)
        delimiter = ','
        for line in decoded_file.splitlines()[:5]:
            if line.count(';') > line.count(',') and line.count(';') > line.count('\t'):
                delimiter = ';'
                break
            elif line.count('\t') > line.count(','):
                delimiter = '\t'
                break

        io_string = io.StringIO(decoded_file)
        reader = csv.reader(io_string, delimiter=delimiter)
        for r in reader:
            if r and any(cell.strip() for cell in r):
                rows.append([c.strip() for c in r])

    if not rows:
        return Response({'error': 'The uploaded file contains no readable student rows.'}, status=status.HTTP_400_BAD_REQUEST)

    email_regex = re.compile(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+')

    # Determine if Row 0 is a Header or Data
    first_row_has_email = any(email_regex.search(c) for c in rows[0])
    has_headers = False

    name_idx = -1
    email_idx = -1
    branch_idx = -1
    year_idx = -1
    section_idx = -1

    if not first_row_has_email:
        # Row 0 contains header names
        has_headers = True
        headers = [h.strip().lower() for h in rows[0]]
        data_rows = rows[1:]

        for idx, h in enumerate(headers):
            if any(term in h for term in ['email', 'mail', 'e-mail', 'username']) and email_idx == -1:
                email_idx = idx
            elif any(term in h for term in ['full name', 'student name', 'candidate name', 'participant name', 'name of', 'your name', 'student\'s name']) and name_idx == -1:
                name_idx = idx
            elif 'name' in h and not any(ex in h for ex in ['branch', 'college', 'event', 'workshop', 'dept']) and name_idx == -1:
                name_idx = idx
            elif any(term in h for term in ['branch', 'department', 'dept', 'course', 'stream', 'discipline']) and branch_idx == -1:
                branch_idx = idx
            elif any(term in h for term in ['year', 'class year', 'study year', 'academic year']) and year_idx == -1:
                year_idx = idx
            elif any(term in h for term in ['section', 'sec', 'division', 'div', 'batch', 'group']) and section_idx == -1:
                section_idx = idx
    else:
        # Row 0 is directly a data row
        data_rows = rows

    # If column indices were not detected from headers, apply default order:
    # Order: Student Name (0), Email (1), Branch (2), Year (3), Section (4)
    if email_idx == -1 or name_idx == -1:
        # Sample first 3 data rows to check if column 1 or column 0 is email
        sample_rows = data_rows[:3]
        col1_is_email = any(len(r) > 1 and email_regex.search(r[1]) for r in sample_rows)
        col0_is_email = any(len(r) > 0 and email_regex.search(r[0]) for r in sample_rows)

        if col1_is_email or not col0_is_email:
            name_idx = 0
            email_idx = 1
            branch_idx = 2
            year_idx = 3
            section_idx = 4
        else:
            email_idx = 0
            name_idx = 1
            branch_idx = 2
            year_idx = 3
            section_idx = 4

    existing_students_map = {s.email.lower(): {'id': s.id, 'name': s.name, 'email': s.email, 'branch': s.branch, 'year': s.year, 'section': s.section} for s in Student.objects.all()}
    seen_in_file = {}
    to_create = []
    duplicates = []

    for row_idx, row in enumerate(data_rows, start=2 if has_headers else 1):
        if not row or not any(cell.strip() for cell in row):
            continue

        extracted_email = ''
        extracted_name = ''
        extracted_branch = 'General'
        extracted_year = '1'
        extracted_section = 'A'

        # 1. Extract Email
        if email_idx != -1 and email_idx < len(row) and row[email_idx].strip():
            m = email_regex.search(row[email_idx].strip())
            if m:
                extracted_email = m.group(0).lower()

        # Fallback: scan whole row for email pattern
        if not extracted_email:
            for cell in row:
                m = email_regex.search(cell)
                if m:
                    extracted_email = m.group(0).lower()
                    break

        if not extracted_email:
            continue

        # 2. Extract Name
        if name_idx != -1 and name_idx < len(row) and row[name_idx].strip():
            extracted_name = row[name_idx].strip()

        # Fallback for name: find first text cell that is not email and not a timestamp
        if not extracted_name or extracted_name == extracted_email:
            for idx_c, cell in enumerate(row):
                c = cell.strip()
                if c and not email_regex.search(c) and not re.match(r'^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}', c):
                    extracted_name = c
                    break

        if not extracted_name:
            extracted_name = extracted_email.split('@')[0].replace('.', ' ').replace('_', ' ').title()

        # 3. Extract Branch
        if branch_idx != -1 and branch_idx < len(row) and row[branch_idx].strip():
            extracted_branch = row[branch_idx].strip()

        # 4. Extract Year
        if year_idx != -1 and year_idx < len(row) and row[year_idx].strip():
            raw_yr = row[year_idx].strip()
            yr_match = re.search(r'\d+', raw_yr)
            extracted_year = yr_match.group(0) if yr_match else raw_yr[:10]

        # 5. Extract Section
        if section_idx != -1 and section_idx < len(row) and row[section_idx].strip():
            extracted_section = row[section_idx].strip()

        # Deduplicate & Collect conflict info
        if extracted_email in existing_students_map:
            duplicates.append({
                'row_number': row_idx,
                'name': extracted_name,
                'email': extracted_email,
                'branch': extracted_branch or 'General',
                'year': extracted_year or '1',
                'section': extracted_section or 'A',
                'conflict_type': 'EXISTING_IN_DATABASE',
                'conflict_message': f"Already exists in database (ID #{existing_students_map[extracted_email]['id']}: {existing_students_map[extracted_email]['name']})",
                'existing_record': existing_students_map[extracted_email]
            })
            continue

        if extracted_email in seen_in_file:
            duplicates.append({
                'row_number': row_idx,
                'name': extracted_name,
                'email': extracted_email,
                'branch': extracted_branch or 'General',
                'year': extracted_year or '1',
                'section': extracted_section or 'A',
                'conflict_type': 'DUPLICATE_IN_FILE',
                'conflict_message': f"Repeated in file (first appeared at row #{seen_in_file[extracted_email]['row_number']})",
                'existing_record': seen_in_file[extracted_email]
            })
            continue

        seen_in_file[extracted_email] = {
            'row_number': row_idx,
            'name': extracted_name,
            'email': extracted_email,
            'branch': extracted_branch or 'General',
            'year': extracted_year or '1',
            'section': extracted_section or 'A'
        }

        to_create.append(Student(
            name=extracted_name,
            email=extracted_email,
            branch=extracted_branch or 'General',
            year=extracted_year or '1',
            section=extracted_section or 'A'
        ))

    if to_create:
        Student.objects.bulk_create(to_create)

    added_count = len(to_create)
    skipped_count = len(duplicates)

    return Response({
        'message': f'⚡ File processed successfully! Added {added_count} new students' + (f' ({skipped_count} duplicate emails detected).' if skipped_count else '.'),
        'addedCount': added_count,
        'skippedCount': skipped_count,
        'duplicates': duplicates
    })

@api_view(['POST'])
@permission_classes([AllowAny])
def bulk_generate_qr_view(request):
    students_without_qr = Student.objects.filter(qr_code_image='') | Student.objects.filter(qr_code_image=None)
    generated_count = 0

    for student in students_without_qr:
        file_content, _ = generate_qr_code(student.unique_token)
        student.qr_code_image.save(f"qr_{student.unique_token}.png", file_content, save=True)
        generated_count += 1

    return Response({
        'message': f'Generated QR codes for {generated_count} students.',
        'generated_count': generated_count
    })

@api_view(['POST'])
@permission_classes([AllowAny])
def bulk_send_emails_view(request):
    student_ids = request.data.get('student_ids', None)
    if student_ids:
        students = list(Student.objects.filter(id__in=student_ids))
    else:
        students = list(Student.objects.filter(qr_sent=False))
        if not students:
            students = list(Student.objects.all())

    import threading
    def _worker():
        with ThreadPoolExecutor(max_workers=min(5, len(students) or 1)) as executor:
            list(executor.map(send_student_qr_email, students))

    threading.Thread(target=_worker, daemon=True).start()

    return Response({
        'message': f'⚡ Superfast Dispatch Started! Sending {len(students)} student passes in background.',
        'sent_count': len(students),
        'failed_count': 0,
        'errors': []
    })

class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all().order_by('-id')
    serializer_class = EventSerializer
    permission_classes = [AllowAny]

    @action(detail=True, methods=['post'], url_path='add-session')
    def add_session(self, request, pk=None):
        event_obj = self.get_object()
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        
        day_label = (data.get('day_label') or '').strip()
        topic = (data.get('topic') or '').strip()
        title = (data.get('title') or '').strip()
        
        if not day_label:
            next_day_num = event_obj.sessions.count() + 1
            day_label = f"Day {next_day_num}"
            data['day_label'] = day_label

        if not title:
            data['title'] = f"{day_label}: {topic}" if topic else f"{event_obj.title} - {day_label}"

        serializer = AttendanceSessionSerializer(data=data)
        if serializer.is_valid():
            session = serializer.save(event=event_obj)
            return Response(AttendanceSessionSerializer(session).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'], url_path='matrix-report')
    def matrix_report(self, request, pk=None):
        event_obj = self.get_object()
        sessions = event_obj.sessions.all().order_by('date', 'id')
        students = Student.objects.all().order_by('name')

        records = AttendanceRecord.objects.filter(session__in=sessions, status='PRESENT')
        student_present_map = {}
        for r in records:
            if r.student_id not in student_present_map:
                student_present_map[r.student_id] = set()
            student_present_map[r.student_id].add(r.session_id)

        session_list = AttendanceSessionSerializer(sessions, many=True).data
        session_ids = [s['id'] for s in session_list]

        matrix_rows = []
        for st in students:
            p_set = student_present_map.get(st.id, set())
            present_days = 0
            st_attendance = {}
            for sid in session_ids:
                is_p = sid in p_set
                st_attendance[str(sid)] = 'PRESENT' if is_p else 'ABSENT'
                if is_p:
                    present_days += 1

            total_days = len(session_ids)
            pct = round((present_days / total_days) * 100) if total_days > 0 else 0
            matrix_rows.append({
                'student': StudentSerializer(st).data,
                'attendance': st_attendance,
                'total_present': present_days,
                'total_days': total_days,
                'percentage': pct
            })

        return Response({
            'event': EventSerializer(event_obj).data,
            'sessions': session_list,
            'matrix': matrix_rows,
            'stats': {
                'total_students': students.count(),
                'total_sessions': len(session_list),
            }
        })

    @action(detail=True, methods=['get'], url_path='export-csv')
    def export_csv(self, request, pk=None):
        event_obj = self.get_object()
        sessions = event_obj.sessions.all().order_by('date', 'id')
        students = Student.objects.all().order_by('name')

        records = AttendanceRecord.objects.filter(session__in=sessions, status='PRESENT')
        student_present_set = {(r.student_id, r.session_id) for r in records}

        response = HttpResponse(content_type='text/csv')
        filename = f"Event_{event_obj.title.replace(' ', '_')}_Attendance_Report.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        
        header = ['Student Name', 'Email', 'Branch', 'Year', 'Section']
        for s in sessions:
            label = s.day_label or f"Session {s.id}"
            if s.topic:
                label += f" ({s.topic})"
            header.append(label)
        header.extend(['Total Present Days', 'Total Event Days', 'Attendance %'])
        writer.writerow(header)

        for st in students:
            row = [st.name, st.email, st.branch, st.year, st.section]
            p_days = 0
            for s in sessions:
                if (st.id, s.id) in student_present_set:
                    row.append('PRESENT')
                    p_days += 1
                else:
                    row.append('ABSENT')
            
            tot = len(sessions)
            pct = f"{round((p_days / tot) * 100)}%" if tot > 0 else "0%"
            row.extend([p_days, tot, pct])
            writer.writerow(row)

        return response

    @action(detail=True, methods=['get'], url_path='export-excel')
    def export_excel(self, request, pk=None):
        event_obj = self.get_object()
        sessions = event_obj.sessions.all().order_by('date', 'id')
        students = Student.objects.all().order_by('name')

        records = AttendanceRecord.objects.filter(session__in=sessions, status='PRESENT')
        student_present_set = {(r.student_id, r.session_id) for r in records}

        html_content = f"""
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
          <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Attendance Matrix</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
          <style>
            table {{ border-collapse: collapse; font-family: Calibri, Arial, sans-serif; }}
            th {{ background-color: #4f46e5; color: #ffffff; font-weight: bold; border: 1px solid #312e81; padding: 8px 12px; text-align: center; }}
            td {{ border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }}
            .present {{ background-color: #dcfce7; color: #166534; font-weight: bold; text-align: center; }}
            .absent {{ background-color: #fee2e2; color: #991b1b; text-align: center; }}
            .title-cell {{ font-size: 16pt; font-weight: bold; color: #1e1b4b; padding: 10px 0; }}
          </style>
        </head>
        <body>
          <table>
            <tr><td colspan="{5 + len(sessions) + 3}" class="title-cell">{event_obj.title} - Consolidated Multi-Day Attendance Sheet</td></tr>
            <tr>
              <th>Student Name</th>
              <th>Email</th>
              <th>Branch</th>
              <th>Year</th>
              <th>Section</th>
        """
        for s in sessions:
            label = s.day_label or f"Session {s.id}"
            if s.topic:
                label += f" - {s.topic}"
            html_content += f"<th>{label} ({s.date})</th>"
        html_content += """
              <th>Present Count</th>
              <th>Total Days</th>
              <th>Attendance %</th>
            </tr>
        """

        for st in students:
            p_days = 0
            html_content += f"<tr><td>{st.name}</td><td>{st.email}</td><td>{st.branch}</td><td>{st.year}</td><td>{st.section}</td>"
            for s in sessions:
                if (st.id, s.id) in student_present_set:
                    html_content += '<td class="present">PRESENT</td>'
                    p_days += 1
                else:
                    html_content += '<td class="absent">ABSENT</td>'
            tot = len(sessions)
            pct = f"{round((p_days / tot) * 100)}%" if tot > 0 else "0%"
            html_content += f'<td style="text-align:center;font-weight:bold;">{p_days}</td><td style="text-align:center;">{tot}</td><td style="text-align:center;font-weight:bold;color:#4f46e5;">{pct}</td></tr>'

        html_content += "</table></body></html>"

        response = HttpResponse(html_content, content_type='application/vnd.ms-excel; charset=utf-8')
        filename = f"{event_obj.title.replace(' ', '_')}_Attendance.xls"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=True, methods=['post'], url_path='generate-passes')
    def generate_passes(self, request, pk=None):
        event_obj = self.get_object()
        students = Student.objects.all()
        existing_st_ids = set(event_obj.passes.values_list('student_id', flat=True))
        to_create = [EventPass(event=event_obj, student=st) for st in students if st.id not in existing_st_ids]
        if to_create:
            EventPass.objects.bulk_create(to_create)
        return Response({
            'message': f'⚡ Generated {len(to_create)} unique event passes for "{event_obj.title}". Total passes: {event_obj.passes.count()}',
            'created_count': len(to_create),
            'total_passes': event_obj.passes.count()
        })

    @action(detail=True, methods=['post'], url_path='send-emails')
    def send_emails(self, request, pk=None):
        event_obj = self.get_object()
        students = Student.objects.all()
        existing_st_ids = set(event_obj.passes.values_list('student_id', flat=True))
        to_create = [EventPass(event=event_obj, student=st) for st in students if st.id not in existing_st_ids]
        if to_create:
            EventPass.objects.bulk_create(to_create)

        passes = list(event_obj.passes.all().select_related('student', 'event'))
        
        # High-speed asynchronous batch dispatch in background thread
        import threading
        threading.Thread(target=send_batch_event_qr_emails, args=(passes,), daemon=True).start()

        return Response({
            'message': f'⚡ Superfast Dispatch Active! Dispatched {len(passes)} event passes for "{event_obj.title}" instantly in background.',
            'sent_count': len(passes),
            'failed_count': 0,
            'errors': []
        })

    @action(detail=True, methods=['get'], url_path='passes')
    def passes_list(self, request, pk=None):
        event_obj = self.get_object()
        students = Student.objects.all()
        existing_st_ids = set(event_obj.passes.values_list('student_id', flat=True))
        to_create = [EventPass(event=event_obj, student=st) for st in students if st.id not in existing_st_ids]
        if to_create:
            EventPass.objects.bulk_create(to_create)
        passes = event_obj.passes.all().select_related('student', 'event').order_by('student__name')
        return Response(EventPassSerializer(passes, many=True).data)

    @action(detail=True, methods=['post'], url_path='send-single-pass')
    def send_single_pass(self, request, pk=None):
        event_obj = self.get_object()
        pass_id = request.data.get('pass_id')
        pass_item = EventPass.objects.filter(event=event_obj, id=pass_id).select_related('student', 'event').first()
        if not pass_item:
            return Response({'error': 'Event pass record not found'}, status=status.HTTP_404_NOT_FOUND)
        log = send_event_qr_email(pass_item)
        return Response({
            'message': f'QR Event Pass sent to {pass_item.student.email} ({pass_item.student.name})!',
            'status': log.status if log else 'SENT',
            'error': log.error_message if log else ''
        })

class AttendanceSessionViewSet(viewsets.ModelViewSet):
    queryset = AttendanceSession.objects.all().order_by('-id')
    serializer_class = AttendanceSessionSerializer
    permission_classes = [AllowAny]

    def perform_create(self, serializer):
        title_val = self.request.data.get('title') or self.request.data.get('name') or 'Class Lecture'
        event_id = self.request.data.get('event') or self.request.data.get('event_id')
        day_label = self.request.data.get('day_label', 'Day 1')
        topic = self.request.data.get('topic', '')
        serializer.save(
            title=title_val,
            event_id=event_id,
            day_label=day_label,
            topic=topic,
            is_active=True
        )

    @action(detail=False, methods=['post'], url_path='create')
    def create_session(self, request):
        return create_session_endpoint_view(request)

    @action(detail=True, methods=['put'])
    def close(self, request, pk=None):
        session_obj = self.get_object()
        session_obj.is_active = False
        session_obj.save()
        return Response({'message': 'Session closed successfully.'})

@api_view(['POST'])
@permission_classes([AllowAny])
def create_session_endpoint_view(request):
    title = request.data.get('title') or request.data.get('name')
    date = request.data.get('date') or datetime.date.today()
    event_id = request.data.get('event') or request.data.get('event_id')
    day_label = request.data.get('day_label', 'Day 1')
    topic = request.data.get('topic', '')

    if not title:
        return Response({'error': 'Title / Name is required.'}, status=status.HTTP_400_BAD_REQUEST)

    session_obj = AttendanceSession.objects.create(
        title=title.strip(),
        date=date,
        event_id=event_id,
        day_label=day_label,
        topic=topic,
        is_active=True
    )
    return Response(AttendanceSessionSerializer(session_obj).data, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([AllowAny])
def attendance_scan_view(request):
    serializer = ScanInputSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({
            'success': False,
            'message': 'Both QR Token and Session ID are required.'
        }, status=status.HTTP_400_BAD_REQUEST)

    token_str = serializer.validated_data['token'].strip()
    session_id = serializer.validated_data['session_id']

    # 1. Check Session
    try:
        session_obj = AttendanceSession.objects.get(id=session_id)
    except AttendanceSession.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Active attendance session not found.'
        }, status=status.HTTP_404_NOT_FOUND)

    if not session_obj.is_active:
        return Response({
            'success': False,
            'message': 'This attendance session is closed.'
        }, status=status.HTTP_400_BAD_REQUEST)

    # 2. Check Token (UUID) - Supports Event-Specific Passes and Student Tokens
    try:
        val_uuid = uuid.UUID(token_str)
    except ValueError:
        return Response({
            'success': False,
            'error_type': 'INVALID_TOKEN',
            'message': 'Unrecognized QR Code format! Invalid UUID token.'
        }, status=status.HTTP_404_NOT_FOUND)

    event_pass = EventPass.objects.filter(event_token=val_uuid).select_related('event', 'student').first()

    if event_pass:
        # Check if the session belongs to a different event
        if session_obj.event and session_obj.event_id != event_pass.event_id:
            return Response({
                'success': False,
                'duplicate': False,
                'error_type': 'WRONG_EVENT',
                'message': f"⚠️ Invalid Pass: This QR code is registered only for '{event_pass.event.title}' and cannot be used for '{session_obj.event.title}'.",
                'student': StudentSerializer(event_pass.student).data
            }, status=status.HTTP_200_OK)

        student = event_pass.student
    else:
        # Fallback to direct Student unique_token
        try:
            student = Student.objects.get(unique_token=val_uuid)
        except Student.DoesNotExist:
            return Response({
                'success': False,
                'error_type': 'INVALID_TOKEN',
                'message': 'Unrecognized QR Code! No student or event pass matches this token.'
            }, status=status.HTTP_404_NOT_FOUND)

    # 3. Check Duplicate Scan
    existing_record = AttendanceRecord.objects.filter(session=session_obj, student=student).first()
    student_data = StudentSerializer(student).data

    if existing_record:
        timestamp_str = existing_record.timestamp.strftime("%I:%M:%S %p")
        return Response({
            'success': False,
            'duplicate': True,
            'message': f'Already marked present! Scan previously recorded at {timestamp_str}',
            'student': student_data,
            'marked_at': existing_record.timestamp,
            'status': 'Duplicate-attempt'
        }, status=status.HTTP_200_OK)

    # 4. Mark Attendance
    record = AttendanceRecord.objects.create(session=session_obj, student=student, status='PRESENT')

    return Response({
        'success': True,
        'duplicate': False,
        'message': 'Attendance marked successfully!',
        'student': student_data,
        'marked_at': record.timestamp,
        'status': 'PRESENT'
    }, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([AllowAny])
def session_report_view(request, session_id):
    try:
        session_obj = AttendanceSession.objects.get(id=session_id)
    except AttendanceSession.DoesNotExist:
        return Response({'error': 'Session not found.'}, status=status.HTTP_404_NOT_FOUND)

    present_records = AttendanceRecord.objects.filter(session=session_obj, status='PRESENT').select_related('student')
    present_student_ids = [r.student.id for r in present_records]

    present_data = []
    for r in present_records:
        st_data = StudentSerializer(r.student).data
        st_data['attendance_id'] = r.id
        st_data['marked_at'] = r.timestamp
        st_data['status'] = r.status
        present_data.append(st_data)

    absent_students = Student.objects.exclude(id__in=present_student_ids).order_by('name')
    absent_data = StudentSerializer(absent_students, many=True).data

    total = len(present_data) + len(absent_data)
    percentage = round((len(present_data) / total) * 100) if total > 0 else 0

    return Response({
        'session': AttendanceSessionSerializer(session_obj).data,
        'stats': {
            'total': total,
            'present': len(present_data),
            'absent': len(absent_data),
            'percentage': percentage
        },
        'present': present_data,
        'absent': absent_data
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def export_attendance_csv_view(request, session_id):
    try:
        session_obj = AttendanceSession.objects.get(id=session_id)
    except AttendanceSession.DoesNotExist:
        return Response({'error': 'Session not found.'}, status=status.HTTP_404_NOT_FOUND)

    present_dict = {r.student_id: r.timestamp for r in AttendanceRecord.objects.filter(session=session_obj, status='PRESENT')}
    students = Student.objects.all().order_by('name')

    response = HttpResponse(content_type='text/csv')
    filename = f"Attendance_{session_obj.title.replace(' ', '_')}_{session_obj.date}.csv"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'

    writer = csv.writer(response)
    writer.writerow(['Name', 'Email', 'Branch', 'Year', 'Section', 'Status', 'Marked Time'])

    for s in students:
        is_present = s.id in present_dict
        status_str = 'PRESENT' if is_present else 'ABSENT'
        marked_time = present_dict[s.id].strftime('%Y-%m-%d %H:%M:%S') if is_present else 'N/A'
        writer.writerow([s.name, s.email, s.branch, s.year, s.section, status_str, marked_time])

    return response

class EmailLogViewSet(viewsets.ModelViewSet):
    queryset = EmailLog.objects.all().order_by('-id')
    serializer_class = EmailLogSerializer
    permission_classes = [AllowAny]

    @action(detail=False, methods=['delete', 'post'], url_path='clear-all')
    def clear_all(self, request):
        count = EmailLog.objects.count()
        EmailLog.objects.all().delete()
        return Response({'message': f'Successfully cleared {count} email logs.', 'deleted_count': count})

# -------------------------------------------------------------
# SMTP CONFIGURATION & TEST EMAIL ENDPOINTS
# -------------------------------------------------------------

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def smtp_settings_view(request):
    setting = SMTPSetting.objects.first()
    
    if request.method == 'GET':
        if not setting:
            return Response({
                'host': 'smtp.gmail.com',
                'port': 587,
                'use_tls': True,
                'user': '',
                'from_name': 'Campus Attendance System',
                'from_email': '',
                'is_active': False
            })
        return Response({
            'host': setting.host,
            'port': setting.port,
            'use_tls': setting.use_tls,
            'user': setting.user,
            'from_name': setting.from_name,
            'from_email': setting.from_email,
            'is_active': setting.is_active
        })

    if request.method == 'POST':
        data = request.data
        if not setting:
            setting = SMTPSetting.objects.create(
                host=data.get('host', 'smtp.gmail.com'),
                port=int(data.get('port', 587)),
                use_tls=data.get('use_tls', True),
                user=data.get('user', '').strip(),
                password=data.get('password', '').strip(),
                from_name=data.get('from_name', 'Campus Attendance System'),
                from_email=data.get('from_email', ''),
                is_active=data.get('is_active', True)
            )
        else:
            setting.host = data.get('host', setting.host)
            setting.port = int(data.get('port', setting.port))
            setting.use_tls = data.get('use_tls', setting.use_tls)
            setting.user = data.get('user', setting.user).strip()
            if data.get('password'):
                setting.password = data.get('password').strip()
            setting.from_name = data.get('from_name', setting.from_name)
            setting.from_email = data.get('from_email', setting.from_email)
            setting.is_active = data.get('is_active', True)
            setting.save()

        return Response({'message': 'SMTP Settings saved and activated successfully!'})

@api_view(['POST'])
@permission_classes([AllowAny])
def test_send_email_view(request):
    target_email = request.data.get('email', '').strip()
    if not target_email:
        return Response({'error': 'Please enter a target recipient email address for testing.'}, status=status.HTTP_400_BAD_REQUEST)

    # Create temporary student for test email
    test_student, _ = Student.objects.get_or_create(
        email=target_email.lower(),
        defaults={
            'name': 'Test Recipient',
            'branch': 'Computer Science',
            'year': '4',
            'section': 'A'
        }
    )

    log_entry = send_student_qr_email(test_student)

    if log_entry.status == 'SENT':
        return Response({
            'success': True,
            'message': f'✅ Real Email sent successfully to {target_email}! Please check your inbox / spam folder.'
        })
    else:
        return Response({
            'success': False,
            'message': f'❌ Email dispatch failed. Error: {log_entry.error_message or "Unknown error"}'
        }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def seed_samples_view(request):
    today = datetime.date.today()
    session_obj, _ = AttendanceSession.objects.get_or_create(
        title='DAA Lecture - 6 Sept',
        defaults={'date': today, 'is_active': True}
    )

    samples = [
        {'name': 'Alex Rivera', 'email': 'alex.rivera@university.edu', 'branch': 'Computer Science', 'year': '3', 'section': 'A'},
        {'name': 'Sophia Chen', 'email': 'sophia.chen@university.edu', 'branch': 'Information Technology', 'year': '2', 'section': 'B'},
        {'name': 'Marcus Johnson', 'email': 'marcus.j@university.edu', 'branch': 'Electronics', 'year': '4', 'section': 'A'},
        {'name': 'Emma Watson', 'email': 'emma.w@university.edu', 'branch': 'Data Science', 'year': '1', 'section': 'C'}
    ]

    created_count = 0
    for s in samples:
        if not Student.objects.filter(email=s['email']).exists():
            st = Student.objects.create(**s)
            file_content, _ = generate_qr_code(st.unique_token)
            st.qr_code_image.save(f"qr_{st.unique_token}.png", file_content, save=True)
            send_student_qr_email(st)
            created_count += 1

    return Response({
        'message': f'Seeded {created_count} sample students!',
        'session_id': session_obj.id
    })
