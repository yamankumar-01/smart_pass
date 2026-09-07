from rest_framework import serializers
from .models import Student, AttendanceSession, AttendanceRecord, EmailLog, SMTPSetting, Event, EventPass
from .utils import generate_qr_code

class StudentSerializer(serializers.ModelSerializer):
    token = serializers.CharField(source='unique_token', read_only=True)
    qr_code_data = serializers.SerializerMethodField()
    enrolled_events = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = ['id', 'unique_token', 'token', 'name', 'email', 'branch', 'year', 'section', 'qr_sent', 'qr_code_image', 'qr_code_data', 'enrolled_events', 'created_at']
        read_only_fields = ['id', 'unique_token', 'qr_sent', 'created_at']

    def get_qr_code_data(self, obj):
        # Quick data URI generation
        token_str = str(obj.unique_token)
        return f"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><rect width='200' height='200' fill='white'/><text x='10' y='100' font-family='monospace' font-size='11' fill='black'>{token_str}</text></svg>"

    def get_enrolled_events(self, obj):
        if hasattr(obj, 'event_passes'):
            return [{'id': ep.event_id, 'title': ep.event.title} for ep in obj.event_passes.all() if ep.event]
        return []

class EventPassSerializer(serializers.ModelSerializer):
    student = StudentSerializer(read_only=True)
    token = serializers.CharField(source='event_token', read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)

    class Meta:
        model = EventPass
        fields = ['id', 'event', 'event_title', 'student', 'event_token', 'token', 'qr_sent', 'created_at']

class AttendanceSessionSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='title', read_only=True)
    status = serializers.SerializerMethodField()
    present_count = serializers.SerializerMethodField()
    total_students = serializers.SerializerMethodField()
    event_title = serializers.CharField(source='event.title', read_only=True, default='')

    class Meta:
        model = AttendanceSession
        fields = ['id', 'event', 'event_title', 'day_label', 'topic', 'title', 'name', 'date', 'is_active', 'status', 'created_at', 'present_count', 'total_students']
        read_only_fields = ['id', 'created_at']

    def get_status(self, obj):
        return 'ACTIVE' if obj.is_active else 'CLOSED'

    def get_present_count(self, obj):
        if hasattr(obj, '_prefetched_objects_cache') and 'records' in obj._prefetched_objects_cache:
            return sum(1 for r in obj.records.all() if r.status == 'PRESENT')
        return obj.records.filter(status='PRESENT').count()

    def get_total_students(self, obj):
        if obj.event_id and hasattr(obj.event, '_prefetched_objects_cache') and 'passes' in obj.event._prefetched_objects_cache:
            return len(obj.event.passes.all())
        elif obj.event_id:
            return obj.event.passes.count()
        return getattr(self.context.get('request'), '_cached_student_count', None) or Student.objects.count()

class EventSerializer(serializers.ModelSerializer):
    sessions = AttendanceSessionSerializer(many=True, read_only=True)
    total_sessions = serializers.SerializerMethodField()
    total_enrolled = serializers.SerializerMethodField()
    passes_sent_count = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = ['id', 'title', 'description', 'start_date', 'end_date', 'is_active', 'created_at', 'sessions', 'total_sessions', 'total_enrolled', 'passes_sent_count']
        read_only_fields = ['id', 'created_at']

    def get_total_sessions(self, obj):
        if hasattr(obj, '_prefetched_objects_cache') and 'sessions' in obj._prefetched_objects_cache:
            return len(obj.sessions.all())
        return obj.sessions.count()

    def get_total_enrolled(self, obj):
        if hasattr(obj, '_prefetched_objects_cache') and 'passes' in obj._prefetched_objects_cache:
            return len(obj.passes.all())
        return obj.passes.count()

    def get_passes_sent_count(self, obj):
        if hasattr(obj, '_prefetched_objects_cache') and 'passes' in obj._prefetched_objects_cache:
            return sum(1 for p in obj.passes.all() if p.qr_sent)
        return obj.passes.filter(qr_sent=True).count()

class AttendanceRecordSerializer(serializers.ModelSerializer):
    student = StudentSerializer(read_only=True)
    marked_at = serializers.DateTimeField(source='timestamp', read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = ['id', 'session', 'student', 'timestamp', 'marked_at', 'status']
        read_only_fields = ['id', 'timestamp']

class EmailLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailLog
        fields = '__all__'

class SMTPSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SMTPSetting
        fields = ['id', 'provider', 'brevo_api_key', 'resend_api_key', 'host', 'port', 'use_tls', 'user', 'password', 'from_name', 'from_email', 'is_active']
        extra_kwargs = {
            'password': {'write_only': True}
        }

class ScanInputSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=100)
    session_id = serializers.IntegerField()
