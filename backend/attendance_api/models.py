import uuid
import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models
from django.utils import timezone

def get_fernet_cipher():
    key_material = getattr(settings, 'SECRET_KEY', 'default-secret-key-smartpass').encode('utf-8')
    derived = hashlib.sha256(key_material).digest()
    b64_key = base64.urlsafe_b64encode(derived)
    return Fernet(b64_key)

def encrypt_value(plaintext):
    if not plaintext:
        return ''
    if str(plaintext).startswith('gAAAAA'):
        return str(plaintext)
    try:
        cipher = get_fernet_cipher()
        return cipher.encrypt(str(plaintext).encode('utf-8')).decode('utf-8')
    except Exception:
        return str(plaintext)

def decrypt_value(ciphertext):
    if not ciphertext:
        return ''
    if not str(ciphertext).startswith('gAAAAA'):
        return str(ciphertext)
    try:
        cipher = get_fernet_cipher()
        return cipher.decrypt(str(ciphertext).encode('utf-8')).decode('utf-8')
    except (InvalidToken, Exception):
        return str(ciphertext)

class EncryptedCharField(models.CharField):
    """
    Transparently encrypts sensitive values before saving to the database,
    and decrypts them on model load. Seamlessly handles legacy plaintext values.
    """
    def __init__(self, *args, **kwargs):
        kwargs.setdefault('max_length', 500)
        super().__init__(*args, **kwargs)

    def from_db_value(self, value, expression, connection):
        if value is None:
            return value
        return decrypt_value(value)

    def to_python(self, value):
        if isinstance(value, str):
            return decrypt_value(value)
        return value

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value is None:
            return value
        return encrypt_value(str(value))

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
    resend_api_key = EncryptedCharField(max_length=500, blank=True, default='')
    brevo_api_key = EncryptedCharField(max_length=500, blank=True, default='')
    host = models.CharField(max_length=255, default='smtp.gmail.com')
    port = models.IntegerField(default=587)
    use_tls = models.BooleanField(default=True)
    user = models.CharField(max_length=255, blank=True, default='')
    password = EncryptedCharField(max_length=500, blank=True, default='')
    from_name = models.CharField(max_length=255, default='Campus Attendance System')
    from_email = models.CharField(max_length=255, default='onboarding@resend.dev')
    is_active = models.BooleanField(default=False)

    def __str__(self):
        if self.provider == 'resend':
            return f"Resend API Config - Active: {self.is_active}"
        return f"SMTP Config ({self.host}:{self.port}) - Active: {self.is_active}"
