import io
import base64
import os
import json
import urllib.request
import urllib.error
import qrcode
from PIL import Image
from email.mime.image import MIMEImage
from django.core.files.base import ContentFile
from django.core.mail import EmailMultiAlternatives, get_connection
from django.conf import settings
from .models import EmailLog, SMTPSetting

def generate_qr_code(unique_token):
    """
    Generates a QR Code image in memory using Python qrcode library.
    Encodes ONLY the unique_token (UUID string) — never raw personal data.
    Returns (ContentFile, data_url_string)
    """
    token_str = str(unique_token)
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(token_str)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#1e293b", back_color="#ffffff")
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    file_content = ContentFile(buffer.getvalue(), name=f"qr_{token_str}.png")

    base64_str = base64.b64encode(buffer.getvalue()).decode('utf-8')
    data_url = f"data:image/png;base64,{base64_str}"

    return file_content, data_url

def send_email_via_resend(api_key, from_addr, to_email, subject, html_body, qr_raw_bytes=None, qr_filename="qr_pass.png"):
    """
    Sends an email using Resend REST API over HTTPS (port 443).
    Bypasses cloud provider port restrictions (e.g., Render Free Tier where SMTP ports 25, 465, 587 are blocked).
    """
    url = "https://api.resend.com/emails"
    
    sender = from_addr.strip() if from_addr else "Aarambh Attendance System <onboarding@resend.dev>"
    
    # Resend requires onboarding@resend.dev for test accounts without a verified custom domain.
    # If the user put a Gmail/Yahoo address as from_email, preserve their display name but use onboarding@resend.dev.
    if '<' in sender and '>' in sender:
        display_part = sender.split('<')[0].strip()
        email_part = sender.split('<')[1].split('>')[0].strip()
        if any(prov in email_part.lower() for prov in ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com']):
            sender = f"{display_part} <onboarding@resend.dev>"
    elif '@' in sender:
        if any(prov in sender.lower() for prov in ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com']):
            sender = "Aarambh Attendance System <onboarding@resend.dev>"

    payload = {
        "from": sender,
        "to": [to_email],
        "subject": subject,
        "html": html_body,
    }

    if qr_raw_bytes:
        payload["attachments"] = [
            {
                "filename": qr_filename,
                "content": base64.b64encode(qr_raw_bytes).decode('utf-8')
            }
        ]

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Authorization': f"Bearer {api_key.strip()}",
            'Content-Type': 'application/json',
            'User-Agent': 'SmartPass/1.0'
        },
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            return True, res_data.get('id', 'sent')
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8', errors='ignore')
        try:
            err_json = json.loads(error_body)
            msg = err_json.get('message') or err_json.get('name') or error_body
        except Exception:
            msg = error_body
        return False, f"Resend API Error ({e.code}): {msg}"
    except Exception as e:
        return False, f"Resend Network Error: {str(e)}"

def get_active_mail_connection():
    """
    Retrieves email connection dynamically from DB SMTPSetting or .env file.
    Returns (connection, from_email_address, provider, resend_key)
    """
    smtp_cfg = SMTPSetting.objects.filter(is_active=True).first()
    env_resend = os.getenv('RESEND_API_KEY', '').strip()
    
    # 1. Check Resend config in DB or environment
    if smtp_cfg and (getattr(smtp_cfg, 'provider', 'resend') == 'resend' or getattr(smtp_cfg, 'resend_api_key', '')):
        key = (smtp_cfg.resend_api_key or '').strip() or env_resend
        from_email = smtp_cfg.from_email.strip() if smtp_cfg.from_email else "onboarding@resend.dev"
        from_name = smtp_cfg.from_name.strip() if smtp_cfg.from_name else "Aarambh Attendance System"
        from_addr = f"{from_name} <{from_email}>"
        return None, from_addr, 'resend', key
    elif env_resend:
        from_addr = os.getenv('DEFAULT_FROM_EMAIL', 'Aarambh Attendance System <onboarding@resend.dev>')
        return None, from_addr, 'resend', env_resend

    # 2. Check traditional SMTP in DB
    if smtp_cfg and smtp_cfg.user and smtp_cfg.password:
        from_addr = f"{smtp_cfg.from_name} <{smtp_cfg.from_email or smtp_cfg.user}>"
        conn = get_connection(
            'django.core.mail.backends.smtp.EmailBackend',
            host=smtp_cfg.host,
            port=smtp_cfg.port,
            username=smtp_cfg.user,
            password=smtp_cfg.password,
            use_tls=smtp_cfg.use_tls,
            timeout=8,
            fail_silently=False
        )
        return conn, from_addr, 'smtp', None

    # 3. Fallback to .env configuration if present
    env_user = os.getenv('EMAIL_HOST_USER', '')
    env_pass = os.getenv('EMAIL_HOST_PASSWORD', '')
    if env_user and env_pass:
        from_addr = os.getenv('DEFAULT_FROM_EMAIL', f'Campus Attendance <{env_user}>')
        conn = get_connection(
            'django.core.mail.backends.smtp.EmailBackend',
            host=os.getenv('EMAIL_HOST', 'smtp.gmail.com'),
            port=int(os.getenv('EMAIL_PORT', 587)),
            username=env_user,
            password=env_pass,
            use_tls=os.getenv('EMAIL_USE_TLS', 'True').lower() == 'true',
            timeout=8,
            fail_silently=False
        )
        return conn, from_addr, 'smtp', None

    # Fallback to console backend if SMTP not configured
    from_addr = settings.DEFAULT_FROM_EMAIL
    conn = get_connection('django.core.mail.backends.console.EmailBackend')
    return conn, from_addr, 'console', None

def send_student_qr_email(student, conn=None, from_addr=None):
    """
    Sends an automated email containing student pass info and inline QR code.
    Supports both Resend API (Port 443) and SMTP (Port 587).
    """
    token_str = str(student.unique_token)
    file_content, qr_data_url = generate_qr_code(token_str)
    qr_raw_bytes = file_content.file.getvalue()

    subject = f"Your Attendance Pass & QR Code - {student.name}"
    
    # HTML body with inline QR code
    html_body = f"""
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px; color: #1e293b;">
      <div style="background-color: #4f46e5; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px;">Campus Attendance System</h1>
        <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">Official Student QR Pass</p>
      </div>

      <div style="background-color: #ffffff; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none;">
        <p style="font-size: 16px;">Hello <strong>{student.name}</strong>,</p>
        <p>Your unique QR Code pass for attendance verification has been generated.</p>

        <div style="background-color: #e0e7ff; border-left: 4px solid #4f46e5; padding: 14px 16px; border-radius: 6px; margin: 16px 0;">
          <p style="margin: 0; font-weight: 700; color: #3730a3; font-size: 0.95rem;">
            📌 Instructions: Show this QR code at the attendance scanner during check-in.
          </p>
        </div>

        <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #334155; font-size: 16px;">Student Profile Details:</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 4px 0; color: #64748b;">Full Name:</td><td style="padding: 4px 0; font-weight: 600;">{student.name}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Email:</td><td style="padding: 4px 0; font-weight: 600;">{student.email}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Branch:</td><td style="padding: 4px 0; font-weight: 600;">{student.branch}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Year & Section:</td><td style="padding: 4px 0; font-weight: 600;">Year {student.year} - Section {student.section}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Pass Token (UUID):</td><td style="padding: 4px 0; font-family: monospace; font-weight: 600; color: #4f46e5;">{token_str}</td></tr>
          </table>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <img src="{qr_data_url}" alt="Attendance QR Code" style="width: 220px; height: 220px; border: 4px solid #e2e8f0; border-radius: 12px; padding: 8px; background: white;" />
          <p style="font-size: 12px; color: #64748b; margin-top: 8px;">Show this QR code at the attendance scanner.</p>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">This is an automated system email sent via Campus Attendance Gateway.</p>
      </div>
    </div>
    """

    c, fa, provider, resend_key = get_active_mail_connection()
    conn = conn or c
    from_addr = from_addr or fa

    status = 'SENT'
    error_msg = ''

    if provider == 'resend' and resend_key:
        ok, res_info = send_email_via_resend(
            api_key=resend_key,
            from_addr=from_addr,
            to_email=student.email,
            subject=subject,
            html_body=html_body,
            qr_raw_bytes=qr_raw_bytes,
            qr_filename=f"qr_pass_{token_str[:8]}.png"
        )
        if ok:
            status = 'SENT'
            if student.pk:
                student.qr_sent = True
                student.save(update_fields=['qr_sent'])
        else:
            status = 'FAILED'
            error_msg = res_info
    else:
        try:
            smtp_html = html_body.replace(qr_data_url, "cid:qr_code_image")
            msg = EmailMultiAlternatives(
                subject=subject,
                body=f"Hello {student.name}, show this QR code at the attendance scanner. Your pass token is {token_str}",
                from_email=from_addr,
                to=[student.email],
                connection=conn
            )
            msg.attach_alternative(smtp_html, "text/html")

            mime_img = MIMEImage(qr_raw_bytes)
            mime_img.add_header('Content-ID', '<qr_code_image>')
            mime_img.add_header('Content-Disposition', 'inline', filename=f"qr_pass_{token_str[:8]}.png")
            msg.attach(mime_img)

            msg.send(fail_silently=False)

            if student.pk:
                student.qr_sent = True
                student.save(update_fields=['qr_sent'])
        except Exception as e:
            error_msg = str(e)
            print(f"Email send error logged for {student.email}: {error_msg}")
            status = 'FAILED'

    log_entry = EmailLog.objects.create(
        student=student if (student and student.pk) else None,
        student_name=student.name,
        email=student.email,
        subject=subject,
        body_html=html_body,
        qr_token=token_str,
        status=status,
        error_message=error_msg
    )
    return log_entry

def send_event_qr_email(event_pass, conn=None, from_addr=None):
    """
    Sends an event-scoped automated email containing the student's unique event pass.
    Supports both Resend API (Port 443) and SMTP (Port 587).
    """
    student = event_pass.student
    event = event_pass.event
    token_str = str(event_pass.event_token)

    file_content, qr_data_url = generate_qr_code(token_str)
    qr_raw_bytes = file_content.file.getvalue()

    subject = f"🎟️ Event Pass & QR Code - {event.title} - {student.name}"

    scheduled_days_html = ""
    for s in event.sessions.all().order_by('date', 'id'):
        scheduled_days_html += f"""
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 6px 8px; font-weight: 600; color: #4f46e5;">{s.day_label or 'Day'}</td>
          <td style="padding: 6px 8px;">{s.topic or s.title}</td>
          <td style="padding: 6px 8px; color: #64748b; font-size: 13px;">{s.date}</td>
        </tr>
        """

    html_body = f"""
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px; color: #1e293b;">
      <div style="background-color: #4f46e5; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; color: white;">
        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; background: rgba(255,255,255,0.2); padding: 3px 10px; border-radius: 20px;">Official Event Pass</span>
        <h1 style="margin: 8px 0 4px; font-size: 22px;">{event.title}</h1>
        <p style="margin: 0; opacity: 0.9; font-size: 13px;">📅 {event.start_date} to {event.end_date}</p>
      </div>

      <div style="background-color: #ffffff; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none;">
        <p style="font-size: 16px;">Hello <strong>{student.name}</strong>,</p>
        <p>You have been registered for <strong>{event.title}</strong>. Your dedicated event QR code pass is below.</p>

        <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
          <p style="margin: 0; font-weight: 700; color: #065f46; font-size: 0.95rem;">
            📌 Reusable Pass: This single QR pass is valid for ALL lecture days/slots of {event.title}.
          </p>
        </div>

        {f'''
        <div style="background-color: #f1f5f9; padding: 14px; border-radius: 8px; margin: 16px 0;">
          <h4 style="margin: 0 0 8px 0; color: #334155; font-size: 14px;">Event Scheduled Lectures / Days:</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            {scheduled_days_html}
          </table>
        </div>
        ''' if scheduled_days_html else ''}

        <div style="background-color: #f8fafc; padding: 14px; border-radius: 8px; margin: 16px 0; border: 1px solid #e2e8f0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 4px 0; color: #64748b;">Attendee:</td><td style="padding: 4px 0; font-weight: 600;">{student.name}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Email:</td><td style="padding: 4px 0; font-weight: 600;">{student.email}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Branch / Year:</td><td style="padding: 4px 0; font-weight: 600;">{student.branch} (Year {student.year} - Sec {student.section})</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Event Pass Token:</td><td style="padding: 4px 0; font-family: monospace; font-weight: 600; color: #4f46e5;">{token_str}</td></tr>
          </table>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <img src="{qr_data_url}" alt="Event QR Code" style="width: 220px; height: 220px; border: 4px solid #e2e8f0; border-radius: 12px; padding: 8px; background: white;" />
          <p style="font-size: 12px; color: #64748b; margin-top: 8px;">Present this QR code during attendance check-in for this event.</p>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">This is an automated system email sent via Campus Attendance Gateway.</p>
      </div>
    </div>
    """

    c, fa, provider, resend_key = get_active_mail_connection()
    conn = conn or c
    from_addr = from_addr or fa

    status = 'SENT'
    error_msg = ''

    if provider == 'resend' and resend_key:
        ok, res_info = send_email_via_resend(
            api_key=resend_key,
            from_addr=from_addr,
            to_email=student.email,
            subject=subject,
            html_body=html_body,
            qr_raw_bytes=qr_raw_bytes,
            qr_filename=f"event_pass_{event.id}_{student.id}.png"
        )
        if ok:
            status = 'SENT'
            event_pass.qr_sent = True
            event_pass.save(update_fields=['qr_sent'])
        else:
            status = 'FAILED'
            error_msg = res_info
    else:
        try:
            smtp_html = html_body.replace(qr_data_url, "cid:qr_code_image")
            msg = EmailMultiAlternatives(
                subject=subject,
                body=f"Hello {student.name}, here is your pass for {event.title}. Your pass token is {token_str}",
                from_email=from_addr,
                to=[student.email],
                connection=conn
            )
            msg.attach_alternative(smtp_html, "text/html")

            mime_img = MIMEImage(qr_raw_bytes)
            mime_img.add_header('Content-ID', '<qr_code_image>')
            mime_img.add_header('Content-Disposition', 'inline', filename=f"event_pass_{event.id}_{student.id}.png")
            msg.attach(mime_img)

            msg.send(fail_silently=False)

            event_pass.qr_sent = True
            event_pass.save(update_fields=['qr_sent'])
        except Exception as e:
            error_msg = str(e)
            print(f"Event email send error for {student.email}: {error_msg}")
            status = 'FAILED'

    log_entry = EmailLog.objects.create(
        student=student if (student and student.pk) else None,
        student_name=student.name,
        email=student.email,
        subject=subject,
        body_html=html_body,
        qr_token=token_str,
        status=status,
        error_message=error_msg
    )
    return log_entry

def send_batch_event_qr_emails(passes):
    """
    Ultra-fast batch event pass email sender.
    Dispatches over parallel Resend HTTPS threads or parallel SMTP connections.
    """
    if not passes:
        return {'sent_count': 0, 'failed_count': 0, 'errors': []}

    c, from_addr, provider, resend_key = get_active_mail_connection()

    if provider == 'resend' and resend_key:
        def _send_single_resend(event_pass):
            student = event_pass.student
            event = event_pass.event
            token_str = str(event_pass.event_token)

            file_content, qr_data_url = generate_qr_code(token_str)
            qr_raw_bytes = file_content.file.getvalue()

            subject = f"🎟️ Event Pass & QR Code - {event.title} - {student.name}"

            scheduled_days_html = ""
            for s in event.sessions.all().order_by('date', 'id'):
                scheduled_days_html += f"""
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 6px 8px; font-weight: 600; color: #4f46e5;">{s.day_label or 'Day'}</td>
                  <td style="padding: 6px 8px;">{s.topic or s.title}</td>
                  <td style="padding: 6px 8px; color: #64748b; font-size: 13px;">{s.date}</td>
                </tr>
                """

            html_body = f"""
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px; color: #1e293b;">
              <div style="background-color: #4f46e5; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; color: white;">
                <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; background: rgba(255,255,255,0.2); padding: 3px 10px; border-radius: 20px;">Official Event Pass</span>
                <h1 style="margin: 8px 0 4px; font-size: 22px;">{event.title}</h1>
                <p style="margin: 0; opacity: 0.9; font-size: 13px;">📅 {event.start_date} to {event.end_date}</p>
              </div>

              <div style="background-color: #ffffff; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none;">
                <p style="font-size: 16px;">Hello <strong>{student.name}</strong>,</p>
                <p>You have been registered for <strong>{event.title}</strong>. Your dedicated event QR code pass is below.</p>

                <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
                  <p style="margin: 0; font-weight: 700; color: #065f46; font-size: 0.95rem;">
                    📌 Reusable Pass: This single QR pass is valid for ALL lecture days/slots of {event.title}.
                  </p>
                </div>

                {f'''
                <div style="background-color: #f1f5f9; padding: 14px; border-radius: 8px; margin: 16px 0;">
                  <h4 style="margin: 0 0 8px 0; color: #334155; font-size: 14px;">Event Scheduled Lectures / Days:</h4>
                  <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    {scheduled_days_html}
                  </table>
                </div>
                ''' if scheduled_days_html else ''}

                <div style="background-color: #f8fafc; padding: 14px; border-radius: 8px; margin: 16px 0; border: 1px solid #e2e8f0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr><td style="padding: 4px 0; color: #64748b;">Attendee:</td><td style="padding: 4px 0; font-weight: 600;">{student.name}</td></tr>
                    <tr><td style="padding: 4px 0; color: #64748b;">Email:</td><td style="padding: 4px 0; font-weight: 600;">{student.email}</td></tr>
                    <tr><td style="padding: 4px 0; color: #64748b;">Branch / Year:</td><td style="padding: 4px 0; font-weight: 600;">{student.branch} (Year {student.year} - Sec {student.section})</td></tr>
                    <tr><td style="padding: 4px 0; color: #64748b;">Event Pass Token:</td><td style="padding: 4px 0; font-family: monospace; font-weight: 600; color: #4f46e5;">{token_str}</td></tr>
                  </table>
                </div>

                <div style="text-align: center; margin: 24px 0;">
                  <img src="{qr_data_url}" alt="Event QR Code" style="width: 220px; height: 220px; border: 4px solid #e2e8f0; border-radius: 12px; padding: 8px; background: white;" />
                  <p style="font-size: 12px; color: #64748b; margin-top: 8px;">Present this QR code during attendance check-in for this event.</p>
                </div>

                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                <p style="font-size: 12px; color: #94a3b8; text-align: center;">This is an automated system email sent via Campus Attendance Gateway.</p>
              </div>
            </div>
            """

            ok, res_info = send_email_via_resend(
                api_key=resend_key,
                from_addr=from_addr,
                to_email=student.email,
                subject=subject,
                html_body=html_body,
                qr_raw_bytes=qr_raw_bytes,
                qr_filename=f"event_pass_{event.id}_{student.id}.png"
            )

            if ok:
                event_pass.qr_sent = True
                event_pass.save(update_fields=['qr_sent'])
                EmailLog.objects.create(
                    student=student,
                    student_name=student.name,
                    email=student.email,
                    subject=subject,
                    body_html=html_body,
                    qr_token=token_str,
                    status='SENT'
                )
            else:
                EmailLog.objects.create(
                    student=student,
                    student_name=student.name,
                    email=student.email,
                    subject=subject,
                    body_html=html_body,
                    qr_token=token_str,
                    status='FAILED',
                    error_message=res_info
                )

        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(_send_single_resend, passes))

        return {
            'sent_count': len(passes),
            'failed_count': 0,
            'errors': []
        }

    # Traditional SMTP bulk dispatch
    def _send_chunk(chunk):
        conn, from_addr, _, _ = get_active_mail_connection()
        try:
            conn.open()
        except Exception:
            pass

        messages = []
        log_data = []

        for event_pass in chunk:
            student = event_pass.student
            event = event_pass.event
            token_str = str(event_pass.event_token)

            file_content, qr_data_url = generate_qr_code(token_str)
            qr_raw_bytes = file_content.file.getvalue()

            subject = f"🎟️ Event Pass & QR Code - {event.title} - {student.name}"

            scheduled_days_html = ""
            for s in event.sessions.all().order_by('date', 'id'):
                scheduled_days_html += f"""
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 6px 8px; font-weight: 600; color: #4f46e5;">{s.day_label or 'Day'}</td>
                  <td style="padding: 6px 8px;">{s.topic or s.title}</td>
                  <td style="padding: 6px 8px; color: #64748b; font-size: 13px;">{s.date}</td>
                </tr>
                """

            html_body = f"""
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px; color: #1e293b;">
              <div style="background-color: #4f46e5; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; color: white;">
                <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; background: rgba(255,255,255,0.2); padding: 3px 10px; border-radius: 20px;">Official Event Pass</span>
                <h1 style="margin: 8px 0 4px; font-size: 22px;">{event.title}</h1>
                <p style="margin: 0; opacity: 0.9; font-size: 13px;">📅 {event.start_date} to {event.end_date}</p>
              </div>

              <div style="background-color: #ffffff; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none;">
                <p style="font-size: 16px;">Hello <strong>{student.name}</strong>,</p>
                <p>You have been registered for <strong>{event.title}</strong>. Your dedicated event QR code pass is below.</p>

                <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
                  <p style="margin: 0; font-weight: 700; color: #065f46; font-size: 0.95rem;">
                    📌 Reusable Pass: This single QR pass is valid for ALL lecture days/slots of {event.title}.
                  </p>
                </div>

                {f'''
                <div style="background-color: #f1f5f9; padding: 14px; border-radius: 8px; margin: 16px 0;">
                  <h4 style="margin: 0 0 8px 0; color: #334155; font-size: 14px;">Event Scheduled Lectures / Days:</h4>
                  <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    {scheduled_days_html}
                  </table>
                </div>
                ''' if scheduled_days_html else ''}

                <div style="background-color: #f8fafc; padding: 14px; border-radius: 8px; margin: 16px 0; border: 1px solid #e2e8f0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr><td style="padding: 4px 0; color: #64748b;">Attendee:</td><td style="padding: 4px 0; font-weight: 600;">{student.name}</td></tr>
                    <tr><td style="padding: 4px 0; color: #64748b;">Email:</td><td style="padding: 4px 0; font-weight: 600;">{student.email}</td></tr>
                    <tr><td style="padding: 4px 0; color: #64748b;">Branch / Year:</td><td style="padding: 4px 0; font-weight: 600;">{student.branch} (Year {student.year} - Sec {student.section})</td></tr>
                    <tr><td style="padding: 4px 0; color: #64748b;">Event Pass Token:</td><td style="padding: 4px 0; font-family: monospace; font-weight: 600; color: #4f46e5;">{token_str}</td></tr>
                  </table>
                </div>

                <div style="text-align: center; margin: 24px 0;">
                  <img src="cid:qr_code_image" alt="Event QR Code" style="width: 220px; height: 220px; border: 4px solid #e2e8f0; border-radius: 12px; padding: 8px; background: white;" />
                  <p style="font-size: 12px; color: #64748b; margin-top: 8px;">Present this QR code during attendance check-in for this event.</p>
                </div>

                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                <p style="font-size: 12px; color: #94a3b8; text-align: center;">This is an automated system email sent via Campus Attendance Gateway.</p>
              </div>
            </div>
            """

            msg = EmailMultiAlternatives(
                subject=subject,
                body=f"Hello {student.name}, here is your pass for {event.title}. Your pass token is {token_str}",
                from_email=from_addr,
                to=[student.email],
                connection=conn
            )
            msg.attach_alternative(html_body, "text/html")

            mime_img = MIMEImage(qr_raw_bytes)
            mime_img.add_header('Content-ID', '<qr_code_image>')
            mime_img.add_header('Content-Disposition', 'inline', filename=f"event_pass_{event.id}_{student.id}.png")
            msg.attach(mime_img)

            messages.append(msg)
            web_inbox_html = html_body.replace('cid:qr_code_image', qr_data_url)
            log_data.append((event_pass, student, subject, web_inbox_html, token_str))

        try:
            conn.send_messages(messages)
            for event_pass, student, subject, web_inbox_html, token_str in log_data:
                event_pass.qr_sent = True
                event_pass.save(update_fields=['qr_sent'])
                EmailLog.objects.create(
                    student=student if (student and student.pk) else None,
                    student_name=student.name,
                    email=student.email,
                    subject=subject,
                    body_html=web_inbox_html,
                    qr_token=token_str,
                    status='SENT'
                )
        except Exception:
            for event_pass, student, subject, web_inbox_html, token_str in log_data:
                try:
                    single_msg = EmailMultiAlternatives(
                        subject=subject,
                        body=f"Pass for {event_pass.event.title}",
                        from_email=from_addr,
                        to=[student.email],
                        connection=conn
                    )
                    single_msg.attach_alternative(web_inbox_html, "text/html")
                    single_msg.send(fail_silently=False)
                    event_pass.qr_sent = True
                    event_pass.save(update_fields=['qr_sent'])
                    EmailLog.objects.create(
                        student=student,
                        student_name=student.name,
                        email=student.email,
                        subject=subject,
                        body_html=web_inbox_html,
                        qr_token=token_str,
                        status='SENT'
                    )
                except Exception as e_indiv:
                    EmailLog.objects.create(
                        student=student,
                        student_name=student.name,
                        email=student.email,
                        subject=subject,
                        body_html=web_inbox_html,
                        qr_token=token_str,
                        status='FAILED',
                        error_message=str(e_indiv)
                    )

        try:
            conn.close()
        except Exception:
            pass

    # Split passes across up to 4 worker chunks for parallel dispatch
    chunk_size = max(1, len(passes) // 4 + 1)
    chunks = [passes[i:i + chunk_size] for i in range(0, len(passes), chunk_size)]
    
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=min(4, len(chunks))) as pool:
        list(pool.map(_send_chunk, chunks))

    return {
        'sent_count': len(passes),
        'failed_count': 0,
        'errors': []
    }
