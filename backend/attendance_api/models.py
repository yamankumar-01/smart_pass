import uuid
from django.db import models
from django.utils import timezone

class Student(models.Model):
    unique_token = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True, editable=False)
    name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    branch = models.CharField(max_length=100)
    year = models.CharField(max_length=10)
    section = models.CharField(max_length=10)
    qr_sent = models.BooleanField(default=False)
    qr_code_image = models.ImageField(upload_to='qr_codes/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.email})"

class Event(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    start_date = models.DateField(default=timezone.now)
    end_date = models.DateField(default=timezone.now)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-id']

    def __str__(self):
        return self.title

class EventPass(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='passes')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='event_passes')
    event_token = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True, editable=False)
    qr_sent = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('event', 'student')
        ordering = ['-id']

    def __str__(self):
        return f"{self.student.name} - [{self.event.title}] ({self.event_token})"

class AttendanceSession(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, null=True, blank=True, related_name='sessions')
    day_label = models.CharField(max_length=50, blank=True, default='Day 1')
    topic = models.CharField(max_length=200, blank=True, default='')
    title = models.CharField(max_length=150)
    date = models.DateField(default=timezone.now)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date', 'id']

    def __str__(self):
        if self.event:
            return f"[{self.event.title}] {self.day_label}: {self.title} - {self.date}"
        return f"{self.title} - {self.date}"

class AttendanceRecord(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='attendance_records')
    session = models.ForeignKey(AttendanceSession, on_delete=models.CASCADE, related_name='records')
    timestamp = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=50, default='PRESENT')

    class Meta:
        unique_together = ('student', 'session')
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.student.name} @ {self.session.title} ({self.status})"

class EmailLog(models.Model):
    student = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True)
    student_name = models.CharField(max_length=150, blank=True, default='')
    email = models.EmailField()
    subject = models.CharField(max_length=255)
    body_html = models.TextField()
    qr_token = models.CharField(max_length=100)
    status = models.CharField(max_length=50, default='SENT')
    error_message = models.TextField(blank=True, default='')
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-sent_at']

    def __str__(self):
        return f"Email to {self.email} ({self.status})"

class SMTPSetting(models.Model):
    provider = models.CharField(max_length=50, default='brevo') # 'brevo', 'resend', or 'smtp'
    resend_api_key = models.CharField(max_length=255, blank=True, default='')
    brevo_api_key = models.CharField(max_length=255, blank=True, default='')
    host = models.CharField(max_length=255, default='smtp.gmail.com')
    port = models.IntegerField(default=587)
    use_tls = models.BooleanField(default=True)
    user = models.CharField(max_length=255, blank=True, default='')
    password = models.CharField(max_length=255, blank=True, default='')
    from_name = models.CharField(max_length=255, default='Campus Attendance System')
    from_email = models.CharField(max_length=255, default='onboarding@resend.dev')
    is_active = models.BooleanField(default=False)

    def __str__(self):
        if self.provider == 'resend':
            return f"Resend API Config - Active: {self.is_active}"
        return f"SMTP Config ({self.host}:{self.port}) - Active: {self.is_active}"
