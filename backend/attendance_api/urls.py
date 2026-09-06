from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    StudentViewSet,
    AttendanceSessionViewSet,
    EmailLogViewSet,
    EventViewSet,
    bulk_upload_csv_view,
    bulk_generate_qr_view,
    bulk_send_emails_view,
    create_session_endpoint_view,
    attendance_scan_view,
    session_report_view,
    export_attendance_csv_view,
    seed_samples_view,
    current_user_view,
    change_password_view,
    smtp_settings_view,
    test_send_email_view
)

router = DefaultRouter()
router.register(r'students', StudentViewSet, basename='student')
router.register(r'events', EventViewSet, basename='event')
router.register(r'sessions', AttendanceSessionViewSet, basename='session')
router.register(r'emails', EmailLogViewSet, basename='email')

urlpatterns = [
    # JWT Authentication Endpoints
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', current_user_view, name='current_user'),
    path('change-password/', change_password_view, name='change_password'),

    # Explicit Section 4 Endpoints
    path('students/upload/', bulk_upload_csv_view, name='students_upload'),
    path('students/generate-qr/', bulk_generate_qr_view, name='students_generate_qr'),
    path('students/send-emails/', bulk_send_emails_view, name='students_send_emails'),
    path('students/clear-all/', StudentViewSet.as_view({'delete': 'clear_all', 'post': 'clear_all'}), name='students_clear_all_slash'),
    path('students/clear-all', StudentViewSet.as_view({'delete': 'clear_all', 'post': 'clear_all'}), name='students_clear_all'),

    path('sessions/create/', create_session_endpoint_view, name='sessions_create'),

    path('attendance/scan/', attendance_scan_view, name='attendance_scan_slash'),
    path('attendance/scan', attendance_scan_view, name='attendance_scan'),
    path('attendance/session/<int:session_id>/', session_report_view, name='session_report_slash'),
    path('attendance/session/<int:session_id>', session_report_view, name='session_report'),
    path('attendance/export/<int:session_id>/', export_attendance_csv_view, name='export_attendance_csv_slash'),
    path('attendance/export/<int:session_id>', export_attendance_csv_view, name='export_attendance_csv'),

    # SMTP Settings & Test Email Endpoints
    path('settings/smtp/', smtp_settings_view, name='smtp_settings_slash'),
    path('settings/smtp', smtp_settings_view, name='smtp_settings'),
    path('settings/test-email/', test_send_email_view, name='test_send_email_slash'),
    path('settings/test-email', test_send_email_view, name='test_send_email'),

    path('seed-samples', seed_samples_view, name='seed_samples'),

    # Router URLs
    path('', include(router.urls)),
]
