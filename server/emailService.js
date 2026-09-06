import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { getDb } from './db.js';

export async function sendQrEmail(student) {
  const db = await getDb();
  
  // Generate QR Code data URL and Buffer
  const qrDataUrl = await QRCode.toDataURL(student.token, {
    errorCorrectionLevel: 'H',
    width: 300,
    margin: 2,
    color: {
      dark: '#1e293b',
      light: '#ffffff'
    }
  });

  const qrBuffer = await QRCode.toBuffer(student.token, {
    errorCorrectionLevel: 'H',
    width: 300,
    margin: 2
  });

  const smtpConfig = await db.get('SELECT * FROM smtp_config WHERE id = 1');

  const subject = `Your Attendance Pass & QR Code - ${student.name}`;
  const htmlBody = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px; color: #1e293b;">
      <div style="background-color: #4f46e5; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px;">Campus Attendance System</h1>
        <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">Official Student QR Pass</p>
      </div>

      <div style="background-color: #ffffff; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0; border-top: none;">
        <p style="font-size: 16px;">Hello <strong>${student.name}</strong>,</p>
        <p>Your unique QR Code pass for attendance verification has been generated. Please keep this email saved or download the attached QR code to display upon entry.</p>

        <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #334155; font-size: 16px;">Student Profile Details:</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 4px 0; color: #64748b;">Full Name:</td><td style="padding: 4px 0; font-weight: 600;">${student.name}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Email:</td><td style="padding: 4px 0; font-weight: 600;">${student.email}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Branch:</td><td style="padding: 4px 0; font-weight: 600;">${student.branch}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Year & Section:</td><td style="padding: 4px 0; font-weight: 600;">Year ${student.year} - Section ${student.section}</td></tr>
            <tr><td style="padding: 4px 0; color: #64748b;">Pass Token:</td><td style="padding: 4px 0; font-family: monospace; font-weight: 600; color: #4f46e5;">${student.token}</td></tr>
          </table>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <img src="cid:student-qr-code" alt="Attendance QR Code" style="width: 220px; height: 220px; border: 4px solid #e2e8f0; border-radius: 12px; padding: 8px; background: white;" />
          <p style="font-size: 12px; color: #64748b; margin-top: 8px;">Present this QR code to the scanner during attendance check-in.</p>
        </div>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">This is an automated system email. Please do not reply directly to this message.</p>
      </div>
    </div>
  `;

  let deliveryStatus = 'SIMULATED';

  if (smtpConfig && smtpConfig.enabled && smtpConfig.host && smtpConfig.user) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port || 587,
        secure: smtpConfig.port === 465,
        auth: {
          user: smtpConfig.user,
          pass: smtpConfig.pass
        }
      });

      await transporter.sendMail({
        from: `"${smtpConfig.from_name || 'Attendance System'}" <${smtpConfig.from_email || smtpConfig.user}>`,
        to: student.email,
        subject: subject,
        html: htmlBody,
        attachments: [
          {
            filename: `qr_${student.name.replace(/\s+/g, '_')}.png`,
            content: qrBuffer,
            cid: 'student-qr-code'
          }
        ]
      });

      deliveryStatus = 'SENT';
    } catch (err) {
      console.error('SMTP Email sending error:', err.message);
      deliveryStatus = 'FAILED';
    }
  }

  // Record in email_logs table for in-app inbox view
  const result = await db.run(
    `INSERT INTO email_logs (student_id, student_name, email, subject, body_html, qr_token, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [student.id, student.name, student.email, subject, htmlBody.replace('cid:student-qr-code', qrDataUrl), student.token, deliveryStatus]
  );

  return {
    success: deliveryStatus !== 'FAILED',
    status: deliveryStatus,
    logId: result.lastID
  };
}
