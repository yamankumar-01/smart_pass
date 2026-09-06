import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'attendance.db');

let dbInstance = null;

export async function getDb() {
  if (dbInstance) return dbInstance;

  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await dbInstance.exec('PRAGMA foreign_keys = ON;');
  await initSchema(dbInstance);

  return dbInstance;
}

async function initSchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      branch TEXT NOT NULL,
      year TEXT NOT NULL,
      section TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      qr_code_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      subject TEXT,
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      marked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'PRESENT',
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      UNIQUE(session_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      student_name TEXT,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_html TEXT,
      qr_token TEXT,
      status TEXT DEFAULT 'SIMULATED',
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS smtp_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      host TEXT DEFAULT '',
      port INTEGER DEFAULT 587,
      user TEXT DEFAULT '',
      pass TEXT DEFAULT '',
      from_name TEXT DEFAULT 'Attendance System',
      from_email TEXT DEFAULT 'noreply@school.edu',
      enabled INTEGER DEFAULT 0
    );
  `);

  // Ensure default SMTP config row exists
  const existingConfig = await db.get('SELECT * FROM smtp_config WHERE id = 1');
  if (!existingConfig) {
    await db.run('INSERT INTO smtp_config (id, enabled) VALUES (1, 0)');
  }
}
