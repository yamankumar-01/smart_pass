import io
import base64
import os
import json
import time
import urllib.request
import urllib.error
import qrcode
from PIL import Image
from email.mime.image import MIMEImage
from django.core.files.base import ContentFile
from django.core.mail import EmailMultiAlternatives, get_connection
from django.conf import settings
from .models import EmailLog, SMTPSetting

def execute_with_backoff(send_func, max_retries=3, backoff_seconds=(2, 6, 15)):
    """
    Executes an email send function with exponential backoff on transient network or API errors.
    send_func is expected to return (bool: ok, str: res_info).
    """
    last_info = ""
    for attempt in range(max_retries):
        try:
            ok, info = send_func()
            if ok:
                return True, info
            last_info = info
        except Exception as err:
            last_info = str(err)

        if attempt < max_retries - 1:
            time.sleep(backoff_seconds[attempt] if attempt < len(backoff_seconds) else backoff_seconds[-1])

    return False, f"Failed after {max_retries} attempts: {last_info}"

def generate_qr_code(unique_token):
    """
    Generates a high-contrast QR Code image in memory using Python qrcode library.
    Encodes ONLY the unique_token (UUID string) for maximum privacy.
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

    img = qr.make_image(fill_color="#0f172a", back_color="#ffffff")
    
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
    Supports inline CID images (contentId) so QR code displays seamlessly inside the card in Gmail.
    """
    url = "https://api.resend.com/emails"
    
    sender = from_addr.strip() if from_addr else "Aarambh Attendance System <onboarding@resend.dev>"
    
    # Resend free tier requires onboarding@resend.dev unless a custom domain is verified
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
                "content": base64.b64encode(qr_raw_bytes).decode('utf-8'),
                "contentId": "qr_code_image",
                "content_id": "qr_code_image"
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

def send_email_via_brevo(api_key, from_name, from_email, to_email, subject, html_body, qr_raw_bytes=None, qr_filename="qr_pass.png"):
    """
    Sends an email using Brevo (formerly Sendinblue) REST API over HTTPS (port 443).
    Allows sending to ANY recipient email address without domain verification.
    Only sender email address needs to be verified in Brevo.
    """
    url = "https://api.brevo.com/v3/smtp/email"

    sender_email = from_email.strip() if from_email else "sender@example.com"
    sender_name = from_name.strip() if from_name else "Aarambh Attendance System"

    if '<' in sender_email and '>' in sender_email:
        sender_name = sender_email.split('<')[0].strip() or sender_name
        sender_email = sender_email.split('<')[1].split('>')[0].strip()

    if qr_raw_bytes:
        qr_b64 = base64.b64encode(qr_raw_bytes).decode('utf-8')
        html_formatted = html_body.replace('cid:qr_code_image', f"data:image/png;base64,{qr_b64}")
    else:
        html_formatted = html_body

    payload = {
        "sender": {
            "name": sender_name,
            "email": sender_email
        },
        "to": [
            {"email": to_email}
        ],
        "subject": subject,
        "htmlContent": html_formatted
    }

    if qr_raw_bytes:
        payload["attachment"] = [
            {
                "content": base64.b64encode(qr_raw_bytes).decode('utf-8'),
                "name": qr_filename
            }
        ]

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'api-key': api_key.strip(),
            'accept': 'application/json',
            'content-type': 'application/json',
            'User-Agent': 'SmartPass/1.0'
        },
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            return True, res_data.get('messageId', 'sent')
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8', errors='ignore')
        try:
            err_json = json.loads(error_body)
            msg = err_json.get('message') or error_body
        except Exception:
            msg = error_body
        return False, f"Brevo API Error ({e.code}): {msg}"
    except Exception as e:
        return False, f"Brevo Network Error: {str(e)}"

def get_all_active_mail_senders():
    """
    Returns a list of all active sender configurations for multi-account load balancing.
    Supports rotating across Brevo API, Resend API, and Gmail SMTP accounts.
    """
    active_configs = list(SMTPSetting.objects.filter(is_active=True).order_by('id'))
    senders = []
    
    for cfg in active_configs:
        if cfg.provider == 'brevo' and cfg.brevo_api_key:
            from_email = cfg.from_email.strip() if cfg.from_email else cfg.user
            from_name = cfg.from_name.strip() if cfg.from_name else "Aarambh Attendance System"
            senders.append({
                'provider': 'brevo',
                'brevo_key': cfg.brevo_api_key.strip(),
                'from_email': from_email,
                'from_name': from_name,
                'from_addr': f"{from_name} <{from_email}>",
                'account_id': cfg.id,
                'user': from_email or 'Brevo API'
            })
        elif cfg.provider == 'resend' and cfg.resend_api_key:
            from_email = cfg.from_email.strip() if cfg.from_email else "onboarding@resend.dev"
            from_name = cfg.from_name.strip() if cfg.from_name else "Aarambh Attendance System"
            senders.append({
                'provider': 'resend',
                'resend_key': cfg.resend_api_key.strip(),
                'from_addr': f"{from_name} <{from_email}>",
                'account_id': cfg.id,
                'user': cfg.from_email or 'Resend API'
            })
        elif cfg.provider == 'smtp' and cfg.user and cfg.password:
            from_addr = f"{cfg.from_name} <{cfg.from_email or cfg.user}>"
            conn = get_connection(
                'django.core.mail.backends.smtp.EmailBackend',
                host=cfg.host,
                port=cfg.port,
                username=cfg.user,
                password=cfg.password,
                use_tls=cfg.use_tls,
                timeout=8,
                fail_silently=False
            )
            senders.append({
                'provider': 'smtp',
                'conn': conn,
                'from_addr': from_addr,
                'account_id': cfg.id,
                'user': cfg.user
            })

    # If no active DB senders, check environment variables
    if not senders:
        env_resend = os.getenv('RESEND_API_KEY', '').strip()
        if env_resend:
            senders.append({
                'provider': 'resend',
                'resend_key': env_resend,
                'from_addr': os.getenv('DEFAULT_FROM_EMAIL', 'Aarambh Attendance System <onboarding@resend.dev>'),
                'account_id': 0,
                'user': 'Env Resend'
            })
        else:
            env_user = os.getenv('EMAIL_HOST_USER', '')
            env_pass = os.getenv('EMAIL_HOST_PASSWORD', '')
            if env_user and env_pass:
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
                senders.append({
                    'provider': 'smtp',
                    'conn': conn,
                    'from_addr': os.getenv('DEFAULT_FROM_EMAIL', f'Campus Attendance <{env_user}>'),
                    'account_id': 0,
                    'user': env_user
                })
            else:
                conn = get_connection('django.core.mail.backends.console.EmailBackend')
                senders.append({
                    'provider': 'console',
                    'conn': conn,
                    'from_addr': settings.DEFAULT_FROM_EMAIL,
                    'account_id': 0,
                    'user': 'Console'
                })

    return senders

def get_active_mail_connection():
    """
    Backwards compatibility helper: returns the primary active sender.
    Returns (connection, from_email_address, provider, resend_key)
    """
    senders = get_all_active_mail_senders()
    primary = senders[0] if senders else None
    if not primary:
        return None, settings.DEFAULT_FROM_EMAIL, 'console', None
    return primary.get('conn'), primary.get('from_addr'), primary.get('provider'), primary.get('resend_key')

def send_student_qr_email(student, conn=None, from_addr=None, specific_sender=None):
    """
    Sends an automated email containing student pass info and inline QR code.
    Can accept a specific sender configuration or automatically pick from active senders.
    """
    token_str = str(student.unique_token)
    file_content, qr_data_url = generate_qr_code(token_str)
    qr_raw_bytes = file_content.file.getvalue()

    subject = f"🎟️ Your Attendance Pass & QR Code - {student.name}"
    
    html_body = f"""
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; color: #1e293b;">
      <div style="background-color: #4f46e5; padding: 24px 20px; text-align: center; color: #ffffff;">
        <div style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; margin-bottom: 8px;">
          OFFICIAL STUDENT PASS
        </div>
        <h1 style="margin: 4px 0 0 0; font-size: 24px; font-weight: 800; color: #ffffff;">SmartPass QR System</h1>
        <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 13px; color: #ffffff;">Campus Attendance Gateway</p>
      </div>

      <div style="padding: 24px 20px; background-color: #ffffff;">
        <p style="font-size: 16px; margin: 0 0 12px 0; color: #1e293b;">Hello <strong>{student.name}</strong>,</p>
        <p style="font-size: 14px; margin: 0 0 16px 0; color: #475569; line-height: 1.5;">
          Your unique QR Code pass for attendance verification has been generated and activated.
        </p>

        <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 6px; margin: 0 0 20px 0;">
          <p style="margin: 0; font-weight: 700; color: #065f46; font-size: 13px;">
            📌 Instructions: Show the QR code below at the scanner during attendance check-in.
          </p>
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
          <h3 style="margin: 0 0 12px 0; color: #334155; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Student Profile:</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #1e293b;">
            <tr><td style="padding: 5px 0; color: #64748b; width: 40%;">Full Name:</td><td style="padding: 5px 0; font-weight: 700;">{student.name}</td></tr>
            <tr><td style="padding: 5px 0; color: #64748b;">Email:</td><td style="padding: 5px 0; font-weight: 600;">{student.email}</td></tr>
            <tr><td style="padding: 5px 0; color: #64748b;">Branch:</td><td style="padding: 5px 0; font-weight: 600;">{student.branch}</td></tr>
            <tr><td style="padding: 5px 0; color: #64748b;">Year & Section:</td><td style="padding: 5px 0; font-weight: 600;">Year {student.year} - Section {student.section}</td></tr>
            <tr><td style="padding: 5px 0; color: #64748b;">Pass Token (UUID):</td><td style="padding: 5px 0; font-family: monospace; font-weight: 700; color: #4f46e5; word-break: break-all;">{token_str}</td></tr>
          </table>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <div style="display: inline-block; padding: 14px; background-color: #ffffff; border: 2px solid #e2e8f0; border-radius: 12px;">
            <img src="cid:qr_code_image" alt="Attendance QR Code" width="220" height="220" style="display: block; width: 220px; height: 220px; margin: 0 auto; border: 0;" />
          </div>
          <p style="font-size: 13px; color: #64748b; margin: 10px 0 0 0; font-weight: 600;">
            Present this QR code during attendance check-in
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          Automated System Email • Campus Attendance Gateway
        </p>
      </div>
    </div>
    """

    if specific_sender:
        sender_cfg = specific_sender
    else:
        senders = get_all_active_mail_senders()
        sender_cfg = senders[0] if senders else {'provider': 'console', 'conn': None, 'from_addr': settings.DEFAULT_FROM_EMAIL}

    provider = sender_cfg.get('provider')
    from_addr = from_addr or sender_cfg.get('from_addr')
    status = 'SENT'
    error_msg = ''

    if provider == 'brevo' and sender_cfg.get('brevo_key'):
        def _send_brevo():
            return send_email_via_brevo(
                api_key=sender_cfg['brevo_key'],
                from_name=sender_cfg.get('from_name', 'Aarambh Attendance System'),
                from_email=sender_cfg.get('from_email', sender_cfg.get('user', '')),
                to_email=student.email,
                subject=subject,
                html_body=html_body,
                qr_raw_bytes=qr_raw_bytes,
                qr_filename=f"qr_pass_{token_str[:8]}.png"
            )
        ok, res_info = execute_with_backoff(_send_brevo)
        if ok:
            status = 'SENT'
            if student.pk:
                student.qr_sent = True
                student.save(update_fields=['qr_sent'])
        else:
            status = 'FAILED'
            error_msg = res_info
    elif provider == 'resend' and sender_cfg.get('resend_key'):
        def _send_resend():
            return send_email_via_resend(
                api_key=sender_cfg['resend_key'],
                from_addr=from_addr,
                to_email=student.email,
                subject=subject,
                html_body=html_body,
                qr_raw_bytes=qr_raw_bytes,
                qr_filename=f"qr_pass_{token_str[:8]}.png"
            )
        ok, res_info = execute_with_backoff(_send_resend)
        if ok:
            status = 'SENT'
            if student.pk:
                student.qr_sent = True
                student.save(update_fields=['qr_sent'])
        else:
            status = 'FAILED'
            error_msg = res_info
    else:
        def _send_smtp():
            conn_obj = conn or sender_cfg.get('conn')
            msg = EmailMultiAlternatives(
                subject=subject,
                body=f"Hello {student.name}, show this QR code at the attendance scanner. Your pass token is {token_str}",
                from_email=from_addr,
                to=[student.email],
                connection=conn_obj
            )
            msg.attach_alternative(html_body, "text/html")

            mime_img = MIMEImage(qr_raw_bytes)
            mime_img.add_header('Content-ID', '<qr_code_image>')
            mime_img.add_header('Content-Disposition', 'inline', filename=f"qr_pass_{token_str[:8]}.png")
            msg.attach(mime_img)

            msg.send(fail_silently=False)
            return True, "SENT"

        ok, res_info = execute_with_backoff(_send_smtp)
        if ok:
            status = 'SENT'
            if student.pk:
                student.qr_sent = True
                student.save(update_fields=['qr_sent'])
        else:
            status = 'FAILED'
            error_msg = res_info
            print(f"Email send error logged for {student.email}: {error_msg}")

    # Replace cid with data URL for browser inbox preview
    web_inbox_html = html_body.replace('cid:qr_code_image', qr_data_url)

    log_entry = EmailLog.objects.create(
        student=student if (student and student.pk) else None,
        student_name=student.name,
        email=student.email,
        subject=subject,
        body_html=web_inbox_html,
        qr_token=token_str,
        status=status,
        error_message=error_msg
    )
    return log_entry

def send_event_qr_email(event_pass, conn=None, from_addr=None, specific_sender=None):
    """
    Sends an event-scoped automated email containing the student's unique event pass.
    Embeds QR code inline inside the card via CID for Gmail mobile app.
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
          <td style="padding: 8px 10px; font-weight: 700; color: #4f46e5;">{s.day_label or 'Day'}</td>
          <td style="padding: 8px 10px; color: #1e293b;">{s.topic or s.title}</td>
          <td style="padding: 8px 10px; color: #64748b; font-size: 13px;">{s.date}</td>
        </tr>
        """

    html_body = f"""
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; color: #1e293b;">
      <div style="background-color: #4f46e5; padding: 24px 20px; text-align: center; color: #ffffff;">
        <div style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; margin-bottom: 8px;">
          OFFICIAL EVENT PASS
        </div>
        <h1 style="margin: 6px 0 2px 0; font-size: 24px; font-weight: 800; color: #ffffff;">{event.title}</h1>
        <p style="margin: 0; opacity: 0.9; font-size: 13px; color: #ffffff;">📅 {event.start_date} to {event.end_date}</p>
      </div>

      <div style="padding: 24px 20px; background-color: #ffffff;">
        <p style="font-size: 16px; margin: 0 0 12px 0; color: #1e293b;">Hello <strong>{student.name}</strong>,</p>
        <p style="font-size: 14px; margin: 0 0 16px 0; color: #475569; line-height: 1.5;">
          You have been registered for <strong>{event.title}</strong>. Your official scannable QR pass is embedded below.
        </p>

        <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 6px; margin: 0 0 20px 0;">
          <p style="margin: 0; font-weight: 700; color: #065f46; font-size: 13px;">
            📌 Reusable Pass: This single QR pass is valid for ALL lecture days of {event.title}.
          </p>
        </div>

        {f'''
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 0 0 20px 0;">
          <h4 style="margin: 0 0 8px 0; color: #334155; font-size: 13px; text-transform: uppercase;">Event Scheduled Lectures / Days:</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            {scheduled_days_html}
          </table>
        </div>
        ''' if scheduled_days_html else ''}

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #1e293b;">
            <tr><td style="padding: 5px 0; color: #64748b; width: 40%;">Attendee:</td><td style="padding: 5px 0; font-weight: 700;">{student.name}</td></tr>
            <tr><td style="padding: 5px 0; color: #64748b;">Email:</td><td style="padding: 5px 0; font-weight: 600;">{student.email}</td></tr>
            <tr><td style="padding: 5px 0; color: #64748b;">Branch / Year:</td><td style="padding: 5px 0; font-weight: 600;">{student.branch} (Year {student.year} - Sec {student.section})</td></tr>
            <tr><td style="padding: 5px 0; color: #64748b;">Event Pass Token:</td><td style="padding: 5px 0; font-family: monospace; font-weight: 700; color: #4f46e5; word-break: break-all;">{token_str}</td></tr>
          </table>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <div style="display: inline-block; padding: 14px; background-color: #ffffff; border: 2px solid #e2e8f0; border-radius: 12px;">
            <img src="cid:qr_code_image" alt="Event QR Code" width="220" height="220" style="display: block; width: 220px; height: 220px; margin: 0 auto; border: 0;" />
          </div>
          <p style="font-size: 13px; color: #64748b; margin: 10px 0 0 0; font-weight: 600;">
            Present this QR code during attendance check-in for this event.
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          Official Event Pass • Campus Attendance Gateway
        </p>
      </div>
    </div>
    """

    if specific_sender:
        sender_cfg = specific_sender
    else:
        senders = get_all_active_mail_senders()
        sender_cfg = senders[0] if senders else {'provider': 'console', 'conn': None, 'from_addr': settings.DEFAULT_FROM_EMAIL}

    provider = sender_cfg.get('provider')
    from_addr = from_addr or sender_cfg.get('from_addr')
    status = 'SENT'
    error_msg = ''

    if provider == 'brevo' and sender_cfg.get('brevo_key'):
        ok, res_info = send_email_via_brevo(
            api_key=sender_cfg['brevo_key'],
            from_name=sender_cfg.get('from_name', 'Aarambh Attendance System'),
            from_email=sender_cfg.get('from_email', sender_cfg.get('user', '')),
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
    elif provider == 'resend' and sender_cfg.get('resend_key'):
        ok, res_info = send_email_via_resend(
            api_key=sender_cfg['resend_key'],
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
            conn = conn or sender_cfg.get('conn')
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

            msg.send(fail_silently=False)

            event_pass.qr_sent = True
            event_pass.save(update_fields=['qr_sent'])
        except Exception as e:
            error_msg = str(e)
            print(f"Event email send error for {student.email}: {error_msg}")
            status = 'FAILED'

    web_inbox_html = html_body.replace('cid:qr_code_image', qr_data_url)

    log_entry = EmailLog.objects.create(
        student=student if (student and student.pk) else None,
        student_name=student.name,
        email=student.email,
        subject=subject,
        body_html=web_inbox_html,
        qr_token=token_str,
        status=status,
        error_message=error_msg
    )
    return log_entry

def send_batch_event_qr_emails(passes):
    """
    Ultra-fast batch event pass email sender.
    Distributes dispatch load round-robin across all active sender accounts (load-balanced).
    """
    if not passes:
        return {'sent_count': 0, 'failed_count': 0, 'errors': []}

    senders = get_all_active_mail_senders()
    if not senders:
        return {'sent_count': 0, 'failed_count': len(passes), 'errors': ['No active email sender accounts configured.']}

    num_senders = len(senders)

    def _send_single_item(item):
        index, event_pass = item
        # Strict duplicate guard: if already sent, skip immediately
        if getattr(event_pass, 'qr_sent', False):
            return

        # Round-robin: rotate through active senders so no single account hits daily limit
        sender_cfg = senders[index % num_senders]
        
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
              <td style="padding: 8px 10px; font-weight: 700; color: #4f46e5;">{s.day_label or 'Day'}</td>
              <td style="padding: 8px 10px; color: #1e293b;">{s.topic or s.title}</td>
              <td style="padding: 8px 10px; color: #64748b; font-size: 13px;">{s.date}</td>
            </tr>
            """

        html_body = f"""
        <div style="font-family: Arial, Helvetica, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; color: #1e293b;">
          <div style="background-color: #4f46e5; padding: 24px 20px; text-align: center; color: #ffffff;">
            <div style="display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; margin-bottom: 8px;">
              OFFICIAL EVENT PASS
            </div>
            <h1 style="margin: 6px 0 2px 0; font-size: 24px; font-weight: 800; color: #ffffff;">{event.title}</h1>
            <p style="margin: 0; opacity: 0.9; font-size: 13px; color: #ffffff;">📅 {event.start_date} to {event.end_date}</p>
          </div>

          <div style="padding: 24px 20px; background-color: #ffffff;">
            <p style="font-size: 16px; margin: 0 0 12px 0; color: #1e293b;">Hello <strong>{student.name}</strong>,</p>
            <p style="font-size: 14px; margin: 0 0 16px 0; color: #475569; line-height: 1.5;">
              You have been registered for <strong>{event.title}</strong>. Your official scannable QR pass is embedded below.
            </p>

            <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 6px; margin: 0 0 20px 0;">
              <p style="margin: 0; font-weight: 700; color: #065f46; font-size: 13px;">
                📌 Reusable Pass: This single QR pass is valid for ALL lecture days of {event.title}.
              </p>
            </div>

            {f'''
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 0 0 20px 0;">
              <h4 style="margin: 0 0 8px 0; color: #334155; font-size: 13px; text-transform: uppercase;">Event Scheduled Lectures / Days:</h4>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                {scheduled_days_html}
              </table>
            </div>
            ''' if scheduled_days_html else ''}

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #1e293b;">
                <tr><td style="padding: 5px 0; color: #64748b; width: 40%;">Attendee:</td><td style="padding: 5px 0; font-weight: 700;">{student.name}</td></tr>
                <tr><td style="padding: 5px 0; color: #64748b;">Email:</td><td style="padding: 5px 0; font-weight: 600;">{student.email}</td></tr>
                <tr><td style="padding: 5px 0; color: #64748b;">Branch / Year:</td><td style="padding: 5px 0; font-weight: 600;">{student.branch} (Year {student.year} - Sec {student.section})</td></tr>
                <tr><td style="padding: 5px 0; color: #64748b;">Event Pass Token:</td><td style="padding: 5px 0; font-family: monospace; font-weight: 700; color: #4f46e5; word-break: break-all;">{token_str}</td></tr>
              </table>
            </div>

            <div style="text-align: center; margin: 24px 0;">
              <div style="display: inline-block; padding: 14px; background-color: #ffffff; border: 2px solid #e2e8f0; border-radius: 12px;">
                <img src="cid:qr_code_image" alt="Event QR Code" width="220" height="220" style="display: block; width: 220px; height: 220px; margin: 0 auto; border: 0;" />
              </div>
              <p style="font-size: 13px; color: #64748b; margin: 10px 0 0 0; font-weight: 600;">
                Present this QR code during attendance check-in for this event.
              </p>
            </div>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
              Official Event Pass • Campus Attendance Gateway
            </p>
          </div>
        </div>
        """

        provider = sender_cfg.get('provider')
        from_addr = sender_cfg.get('from_addr')
        web_inbox_html = html_body.replace('cid:qr_code_image', qr_data_url)

        if provider == 'brevo' and sender_cfg.get('brevo_key'):
            ok, res_info = send_email_via_brevo(
                api_key=sender_cfg['brevo_key'],
                from_name=sender_cfg.get('from_name', 'Aarambh Attendance System'),
                from_email=sender_cfg.get('from_email', sender_cfg.get('user', '')),
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
                    body_html=web_inbox_html,
                    qr_token=token_str,
                    status='SENT'
                )
            else:
                EmailLog.objects.create(
                    student=student,
                    student_name=student.name,
                    email=student.email,
                    subject=subject,
                    body_html=web_inbox_html,
                    qr_token=token_str,
                    status='FAILED',
                    error_message=res_info
                )
        if provider == 'brevo' and sender_cfg.get('brevo_key'):
            def _send_brevo_item():
                return send_email_via_brevo(
                    api_key=sender_cfg['brevo_key'],
                    from_name=sender_cfg.get('from_name', 'Aarambh Attendance System'),
                    from_email=sender_cfg.get('from_email', sender_cfg.get('user', '')),
                    to_email=student.email,
                    subject=subject,
                    html_body=html_body,
                    qr_raw_bytes=qr_raw_bytes,
                    qr_filename=f"event_pass_{event.id}_{student.id}.png"
                )
            ok, res_info = execute_with_backoff(_send_brevo_item)
            if ok:
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
            else:
                EmailLog.objects.create(
                    student=student,
                    student_name=student.name,
                    email=student.email,
                    subject=subject,
                    body_html=web_inbox_html,
                    qr_token=token_str,
                    status='FAILED',
                    error_message=res_info
                )
        elif provider == 'resend' and sender_cfg.get('resend_key'):
            def _send_resend_item():
                return send_email_via_resend(
                    api_key=sender_cfg['resend_key'],
                    from_addr=from_addr,
                    to_email=student.email,
                    subject=subject,
                    html_body=html_body,
                    qr_raw_bytes=qr_raw_bytes,
                    qr_filename=f"event_pass_{event.id}_{student.id}.png"
                )
            ok, res_info = execute_with_backoff(_send_resend_item)
            if ok:
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
            else:
                EmailLog.objects.create(
                    student=student,
                    student_name=student.name,
                    email=student.email,
                    subject=subject,
                    body_html=web_inbox_html,
                    qr_token=token_str,
                    status='FAILED',
                    error_message=res_info
                )
        else:
            def _send_smtp_item():
                conn_obj = sender_cfg.get('conn')
                single_msg = EmailMultiAlternatives(
                    subject=subject,
                    body=f"Pass for {event_pass.event.title}",
                    from_email=from_addr,
                    to=[student.email],
                    connection=conn_obj
                )
                single_msg.attach_alternative(html_body, "text/html")
                mime_img = MIMEImage(qr_raw_bytes)
                mime_img.add_header('Content-ID', '<qr_code_image>')
                mime_img.add_header('Content-Disposition', 'inline', filename=f"event_pass_{event.id}_{student.id}.png")
                single_msg.attach(mime_img)
                single_msg.send(fail_silently=False)
                return True, "SENT"

            ok, res_info = execute_with_backoff(_send_smtp_item)
            if ok:
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
            else:
                EmailLog.objects.create(
                    student=student,
                    student_name=student.name,
                    email=student.email,
                    subject=subject,
                    body_html=web_inbox_html,
                    qr_token=token_str,
                    status='FAILED',
                    error_message=res_info
                )

    from concurrent.futures import ThreadPoolExecutor
    indexed_passes = list(enumerate(passes))
    with ThreadPoolExecutor(max_workers=min(6, len(passes))) as pool:
        list(pool.map(_send_single_item, indexed_passes))

    return {
        'sent_count': len(passes),
        'failed_count': 0,
        'errors': []
    }
