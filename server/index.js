import express from 'express';
import cors from 'cors';
import multer from 'multer';
import csvParser from 'csv-parser';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';
import { sendQrEmail } from './emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Configure multer for CSV uploads in memory or temp dir
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

// Utility to generate secure random token
function generateStudentToken() {
  return 'att_' + crypto.randomBytes(12).toString('hex');
}

// -------------------------------------------------------------
// STUDENT MANAGEMENT ENDPOINTS
// -------------------------------------------------------------

// Add Single Student
app.post('/api/students', async (req, res) => {
  try {
    const { name, email, branch, year, section } = req.body;

    if (!name || !email || !branch || !year || !section) {
      return res.status(400).json({ error: 'All fields (name, email, branch, year, section) are required.' });
    }

    const db = await getDb();
    
    // Check duplicate email
    const existing = await db.get('SELECT id FROM students WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: `Student with email ${email} already exists.` });
    }

    const token = generateStudentToken();
    const qrCodeData = await QRCode.toDataURL(token, { errorCorrectionLevel: 'H' });

    const result = await db.run(
      `INSERT INTO students (name, email, branch, year, section, token, qr_code_data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), email.trim().toLowerCase(), branch.trim(), year.toString().trim(), section.trim().toUpperCase(), token, qrCodeData]
    );

    const newStudent = {
      id: result.lastID,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      branch: branch.trim(),
      year: year.toString().trim(),
      section: section.trim().toUpperCase(),
      token,
      qr_code_data: qrCodeData
    };

    // Trigger email send (runs in background or inline)
    sendQrEmail(newStudent).catch(err => console.error('Failed sending QR email:', err));

    res.status(201).json({
      message: 'Student added successfully!',
      student: newStudent
    });
  } catch (err) {
    console.error('Error adding student:', err);
    res.status(500).json({ error: err.message });
  }
});

// CSV Bulk Upload
app.post('/api/students/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No CSV file uploaded.' });
  }

  const filePath = req.file.path;
  const db = await getDb();

  const studentsToInsert = [];
  const errors = [];

  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row) => {
          // Normalize key names regardless of case/whitespace
          const normalized = {};
          Object.keys(row).forEach(key => {
            const cleanKey = key.trim().toLowerCase();
            normalized[cleanKey] = row[key] ? row[key].trim() : '';
          });

          const name = normalized.name || normalized['student name'] || normalized['full name'];
          const email = normalized.email || normalized['email address'];
          const branch = normalized.branch || normalized['department'];
          const year = normalized.year || normalized['class year'];
          const section = normalized.section || normalized['sec'];

          if (name && email && branch && year && section) {
            studentsToInsert.push({ name, email: email.toLowerCase(), branch, year, section });
          } else {
            errors.push(`Row missing required fields: ${JSON.stringify(row)}`);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Remove uploaded temp file
    fs.unlinkSync(filePath);

    let addedCount = 0;
    let skippedCount = 0;
    const addedStudents = [];

    for (const s of studentsToInsert) {
      const existing = await db.get('SELECT id FROM students WHERE email = ?', [s.email]);
      if (existing) {
        skippedCount++;
        continue;
      }

      const token = generateStudentToken();
      const qrCodeData = await QRCode.toDataURL(token, { errorCorrectionLevel: 'H' });

      const result = await db.run(
        `INSERT INTO students (name, email, branch, year, section, token, qr_code_data)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [s.name, s.email, s.branch, s.year, s.section, token, qrCodeData]
      );

      const createdStudent = {
        id: result.lastID,
        name: s.name,
        email: s.email,
        branch: s.branch,
        year: s.year,
        section: s.section,
        token,
        qr_code_data: qrCodeData
      };

      addedStudents.push(createdStudent);
      addedCount++;

      // Dispatch email
      sendQrEmail(createdStudent).catch(err => console.error('Failed sending email in batch:', err));
    }

    res.json({
      message: `CSV Processed successfully! Added ${addedCount} new students. ${skippedCount} existing emails skipped.`,
      addedCount,
      skippedCount,
      errorsCount: errors.length,
      sampleAdded: addedStudents.slice(0, 5)
    });
  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    console.error('CSV Upload processing failed:', err);
    res.status(500).json({ error: 'Failed to process CSV file. Make sure headers are Name, Email, Branch, Year, Section.' });
  }
});

// List all students
app.get('/api/students', async (req, res) => {
  try {
    const { search, branch, year, section } = req.query;
    const db = await getDb();

    let query = 'SELECT * FROM students WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR email LIKE ? OR token LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (branch) {
      query += ' AND branch = ?';
      params.push(branch);
    }
    if (year) {
      query += ' AND year = ?';
      params.push(year);
    }
    if (section) {
      query += ' AND section = ?';
      params.push(section);
    }

    query += ' ORDER BY id DESC';

    const students = await db.all(query, params);
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete student
app.delete('/api/students/:id', async (req, res) => {
  try {
    const db = await getDb();
    await db.run('DELETE FROM students WHERE id = ?', [req.params.id]);
    res.json({ message: 'Student deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resend Email for a Student
app.post('/api/students/:id/resend-email', async (req, res) => {
  try {
    const db = await getDb();
    const student = await db.get('SELECT * FROM students WHERE id = ?', [req.params.id]);

    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    const emailResult = await sendQrEmail(student);
    res.json({
      message: `QR Email dispatch initiated to ${student.email}!`,
      details: emailResult
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// SESSION MANAGEMENT ENDPOINTS
// -------------------------------------------------------------

// Create New Attendance Session
app.post('/api/sessions', async (req, res) => {
  try {
    const { name, date, subject } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Session Name is required.' });
    }

    const sessionDate = date || new Date().toISOString().split('T')[0];
    const db = await getDb();

    const result = await db.run(
      `INSERT INTO sessions (name, date, subject, status) VALUES (?, ?, ?, 'ACTIVE')`,
      [name.trim(), sessionDate, subject ? subject.trim() : '']
    );

    const session = await db.get('SELECT * FROM sessions WHERE id = ?', [result.lastID]);
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const db = await getDb();
    const sessions = await db.all(`
      SELECT s.*, 
        (SELECT COUNT(*) FROM attendance WHERE session_id = s.id) as present_count,
        (SELECT COUNT(*) FROM students) as total_students
      FROM sessions s
      ORDER BY s.id DESC
    `);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Close Session
app.put('/api/sessions/:id/close', async (req, res) => {
  try {
    const db = await getDb();
    await db.run(`UPDATE sessions SET status = 'CLOSED' WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Session closed successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// CORE QR SCAN & ATTENDANCE ENDPOINT
// -------------------------------------------------------------

app.post('/api/attendance/scan', async (req, res) => {
  try {
    let { token, session_id } = req.body;

    if (!token || !session_id) {
      return res.status(400).json({
        success: false,
        error_type: 'INVALID_INPUT',
        message: 'Both QR Token and Session ID are required for scanning.'
      });
    }

    token = token.trim();
    const db = await getDb();

    // 1. Verify Active Session
    const session = await db.get('SELECT * FROM sessions WHERE id = ?', [session_id]);
    if (!session) {
      return res.status(404).json({
        success: false,
        error_type: 'SESSION_NOT_FOUND',
        message: 'Active attendance session not found.'
      });
    }

    if (session.status === 'CLOSED') {
      return res.status(400).json({
        success: false,
        error_type: 'SESSION_CLOSED',
        message: 'This attendance session has been closed.'
      });
    }

    // 2. Verify Student Token
    const student = await db.get('SELECT * FROM students WHERE token = ?', [token]);
    if (!student) {
      return res.status(404).json({
        success: false,
        error_type: 'INVALID_TOKEN',
        message: 'Unrecognized QR Code! No student record matches this token.'
      });
    }

    // 3. Check Duplicate Scan
    const existingAttendance = await db.get(
      'SELECT * FROM attendance WHERE session_id = ? AND student_id = ?',
      [session_id, student.id]
    );

    if (existingAttendance) {
      return res.status(200).json({
        success: false,
        duplicate: true,
        message: `Already marked present! Scan previously recorded at ${new Date(existingAttendance.marked_at).toLocaleTimeString()}`,
        student: {
          id: student.id,
          name: student.name,
          email: student.email,
          branch: student.branch,
          year: student.year,
          section: student.section
        },
        marked_at: existingAttendance.marked_at
      });
    }

    // 4. Mark Attendance
    const result = await db.run(
      'INSERT INTO attendance (session_id, student_id, marked_at, status) VALUES (?, ?, CURRENT_TIMESTAMP, ?)',
      [session_id, student.id, 'PRESENT']
    );

    const newRecord = await db.get('SELECT * FROM attendance WHERE id = ?', [result.lastID]);

    res.status(200).json({
      success: true,
      duplicate: false,
      message: 'Attendance marked successfully!',
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        branch: student.branch,
        year: student.year,
        section: student.section
      },
      marked_at: newRecord.marked_at
    });
  } catch (err) {
    console.error('Scan processing error:', err);
    res.status(500).json({ success: false, message: 'Server error processing scan.' });
  }
});

// Get Attendance for a Session
app.get('/api/attendance/session/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const db = await getDb();

    const session = await db.get('SELECT * FROM sessions WHERE id = ?', [sessionId]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    // Present Students
    const presentStudents = await db.all(`
      SELECT a.id as attendance_id, a.marked_at, a.status, s.*
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      WHERE a.session_id = ?
      ORDER BY a.marked_at DESC
    `, [sessionId]);

    const presentIds = presentStudents.map(p => p.id);

    // Absent Students
    let absentStudents = [];
    if (presentIds.length > 0) {
      absentStudents = await db.all(`
        SELECT * FROM students WHERE id NOT IN (${presentIds.join(',')}) ORDER BY name ASC
      `);
    } else {
      absentStudents = await db.all(`SELECT * FROM students ORDER BY name ASC`);
    }

    res.json({
      session,
      stats: {
        total: presentStudents.length + absentStudents.length,
        present: presentStudents.length,
        absent: absentStudents.length,
        percentage: (presentStudents.length + absentStudents.length) > 0 
          ? Math.round((presentStudents.length / (presentStudents.length + absentStudents.length)) * 100) 
          : 0
      },
      present: presentStudents,
      absent: absentStudents
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CSV Export for Session Attendance
app.get('/api/attendance/export/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    const db = await getDb();

    const session = await db.get('SELECT * FROM sessions WHERE id = ?', [sessionId]);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const records = await db.all(`
      SELECT 
        s.name, s.email, s.branch, s.year, s.section,
        COALESCE(a.status, 'ABSENT') as attendance_status,
        COALESCE(a.marked_at, 'N/A') as time_marked
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id AND a.session_id = ?
      ORDER BY s.name ASC
    `, [sessionId]);

    let csvContent = 'Name,Email,Branch,Year,Section,Status,Marked Time\n';
    records.forEach(r => {
      const cleanName = `"${r.name.replace(/"/g, '""')}"`;
      csvContent += `${cleanName},${r.email},${r.branch},${r.year},${r.section},${r.attendance_status},"${r.time_marked}"\n`;
    });

    const filename = `Attendance_${session.name.replace(/\s+/g, '_')}_${session.date}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// EMAIL LOGS & SETTINGS ENDPOINTS
// -------------------------------------------------------------

app.get('/api/emails', async (req, res) => {
  try {
    const db = await getDb();
    const logs = await db.all('SELECT * FROM email_logs ORDER BY id DESC LIMIT 50');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings/smtp', async (req, res) => {
  try {
    const db = await getDb();
    const config = await db.get('SELECT id, host, port, user, from_name, from_email, enabled FROM smtp_config WHERE id = 1');
    res.json(config || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/smtp', async (req, res) => {
  try {
    const { host, port, user, pass, from_name, from_email, enabled } = req.body;
    const db = await getDb();

    await db.run(
      `UPDATE smtp_config 
       SET host = ?, port = ?, user = ?, pass = COALESCE(NULLIF(?, ''), pass), from_name = ?, from_email = ?, enabled = ?
       WHERE id = 1`,
      [host || '', port || 587, user || '', pass || '', from_name || 'Attendance System', from_email || '', enabled ? 1 : 0]
    );

    res.json({ message: 'SMTP settings updated successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create sample students helper endpoint for quick testing
app.post('/api/seed-samples', async (req, res) => {
  try {
    const db = await getDb();
    
    // Check if session exists
    let activeSession = await db.get(`SELECT * FROM sessions WHERE status = 'ACTIVE' ORDER BY id DESC LIMIT 1`);
    if (!activeSession) {
      const today = new Date().toISOString().split('T')[0];
      const result = await db.run(
        `INSERT INTO sessions (name, date, subject, status) VALUES ('CS101 - Morning Lecture', ?, 'Computer Science', 'ACTIVE')`,
        [today]
      );
      activeSession = await db.get('SELECT * FROM sessions WHERE id = ?', [result.lastID]);
    }

    const samples = [
      { name: 'Alex Rivera', email: 'alex.rivera@university.edu', branch: 'Computer Science', year: '3', section: 'A' },
      { name: 'Sophia Chen', email: 'sophia.chen@university.edu', branch: 'Information Technology', year: '2', section: 'B' },
      { name: 'Marcus Johnson', email: 'marcus.j@university.edu', branch: 'Electronics', year: '4', section: 'A' },
      { name: 'Emma Watson', email: 'emma.w@university.edu', branch: 'Data Science', year: '1', section: 'C' }
    ];

    let createdCount = 0;
    for (const s of samples) {
      const existing = await db.get('SELECT id FROM students WHERE email = ?', [s.email]);
      if (!existing) {
        const token = generateStudentToken();
        const qrCodeData = await QRCode.toDataURL(token, { errorCorrectionLevel: 'H' });
        const resIns = await db.run(
          `INSERT INTO students (name, email, branch, year, section, token, qr_code_data) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [s.name, s.email, s.branch, s.year, s.section, token, qrCodeData]
        );

        const created = { id: resIns.lastID, ...s, token, qr_code_data: qrCodeData };
        sendQrEmail(created).catch(() => {});
        createdCount++;
      }
    }

    res.json({ message: `Seeded ${createdCount} sample students! Active session ID: ${activeSession.id}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve sample CSV file for instant user download
app.get('/api/sample-csv', (req, res) => {
  const sampleCsvPath = path.join(__dirname, 'sample_students.csv');
  if (!fs.existsSync(sampleCsvPath)) {
    const content = `Name,Email,Branch,Year,Section\nJohn Doe,john.doe@example.com,Computer Science,3,A\nJane Smith,jane.smith@example.com,Electrical Engineering,2,B\nRobert Brown,robert.b@example.com,Mechanical,4,C\nEmily Davis,emily.d@example.com,Information Technology,1,A\n`;
    fs.writeFileSync(sampleCsvPath, content);
  }
  res.download(sampleCsvPath, 'sample_students.csv');
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`🚀 Attendance Server running on http://localhost:${PORT}`);
});
