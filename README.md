# SmartPass QR-Based Attendance System

A full-stack, real-time QR Attendance System built with **Django 5.0 + Django REST Framework (DRF)** on the backend and **React + Vite + Axios** on the frontend with **JWT Authentication**.

---

## 🌟 Architecture & Features

- **Unguessable UUID Tokens**: Encodes ONLY a 128-bit `unique_token` (UUID) into the QR code pass. Zero personal student data is stored inside the QR code to prevent data leakage if the image is shared.
- **Python `qrcode` Pass Generator**: Server-side PNG generation using Python's `qrcode[pil]` & `Pillow` library, storing PNG images in Django media storage and generating base64 Data URLs.
- **Automated Email Pass Dispatch**: Sends responsive HTML email passes to each student's email with their profile details, embedded inline QR pass, and instructions: *"Show this QR code at the attendance scanner"*. Includes graceful failure logging and admin retry capabilities.
- **Camera QR Scanner & Live Verification**: Real-time webcam scanner (`html5-qrcode`) with audio feedback (double-chime on success, warning buzzer on duplicate). Displays a confirmation card with student **Name, Branch, Year, and Section**.
- **Duplicate Prevention**: Enforces database-level `unique_together = ('student', 'session')` constraint. Re-scanning a student in the same session is rejected with an **"Already marked"** status banner and timestamp.
- **Running Attendance Counter**: Displays live `"X / Total marked present"` count for the active session (e.g. *2 / 4 Marked Present*). Includes an optional **Multi-Device Sync Polling Switch** for multi-scanner setups.
- **JWT Admin Authentication**: Secured with `djangorestframework-simplejwt`. All admin endpoints require Bearer tokens.
- **Database Flexibility**: Default SQLite setup for development, pre-configured with environment variables (`DB_ENGINE`, `DB_NAME`, `DB_USER`, `DB_HOST`, `DB_PORT`) for seamless PostgreSQL migration.
- **Attendance Analytics & CSV Export**: Real-time stats breakdown and one-click export of session attendance reports to CSV.

---

## 📂 Project Structure

```text
attendance/
├── backend/                  # Django REST Framework Backend
│   ├── attendance_api/       # Models, Serializers, Views, URLs, Utils
│   │   ├── models.py         # Student, AttendanceSession, AttendanceRecord, EmailLog
│   │   ├── views.py          # DRF ViewSets & REST API Endpoints
│   │   ├── utils.py          # Python qrcode & Django Email helpers
│   │   └── serializers.py    # DRF Serializers
│   ├── attendance_project/   # Django Settings & Root URL Conf
│   ├── seed_dummy_students.py# Seed script populating ~10 dummy students
│   ├── requirements.txt      # Python dependencies
│   ├── .env.example          # Environment variables template
│   └── manage.py             # Django management CLI
└── client/                   # React + Vite + Axios Frontend
    ├── src/
    │   ├── api/axios.js      # Axios instance with JWT interceptors
    │   ├── components/
    │   │   ├── Login.jsx     # Admin JWT Login Page
    │   │   ├── Scanner.jsx   # Live Scan Dashboard & Camera Scanner
    │   │   ├── StudentManager.jsx # Student Upload & CSV Import Page
    │   │   ├── QrDispatch.jsx# QR Pass Generation & Email Dispatch Page
    │   │   └── AttendanceReports.jsx # Reports & CSV Export Page
    │   ├── App.jsx           # Main React Application Routing
    │   └── index.css         # Modern Dark/Light Theme Styling
    ├── package.json          # Frontend npm dependencies
    └── vite.config.js        # Vite dev server with proxy to Django backend
```

---

## 🛠️ Prerequisites

- **Python**: `3.10` or higher
- **Node.js**: `18.x` or higher (npm `9+`)

---

## 🚀 Step-by-Step Local Setup Guide

### 1. Backend Setup (Django DRF)

Open a terminal and navigate to the `backend` folder:

```bash
cd backend
```

Install Python dependencies:

```bash
python -m pip install -r requirements.txt
```

Set up environment variables (optional, copy template):

```bash
cp .env.example .env
```

Apply database migrations:

```bash
python manage.py makemigrations
python manage.py migrate
```

Create an Admin Superuser:

```bash
python manage.py createsuperuser
```
*(Follow the interactive prompts to set your own username, email, and password)*

Seed ~10 Dummy Students & Active Session for instant testing (optional):

```bash
python seed_dummy_students.py
```

Start the Django Backend Server:

```bash
python manage.py runserver 8000
```
*The backend API will run on `http://localhost:8000/`*

---

### 2. Frontend Setup (React + Vite + Axios)

Open a new terminal and navigate to the `client` folder:

```bash
cd client
```

Install npm packages:

```bash
npm install
```

Start the Vite Frontend Development Server:

```bash
npm run dev
```
*The React app will run on `http://localhost:3000/`*

---

## 👥 User Roles & Access

| Role | Access Level |
| :--- | :--- |
| **Volunteer (Scanner)** | Direct Live Scanner & Session Selection Only |
| **Super Admin** | Full Control (Events, Student Directory, CSV Upload, QR Dispatch, Reports, SMTP Settings) |

---

## 🔌 API Endpoint Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/api/token/` | Obtain JWT Access and Refresh tokens |
| **POST** | `/api/token/refresh/` | Refresh expired JWT Access token |
| **POST** | `/api/students/upload/` | Bulk upload students via CSV parsing |
| **POST** | `/api/students/generate-qr/` | Generate QR pass images for students without one |
| **POST** | `/api/students/send-emails/` | Batch dispatch QR code pass emails to students |
| **POST** | `/api/sessions/create/` | Create a new attendance session |
| **POST** | `/api/attendance/scan/` | Core scan endpoint: receives `{ token, session_id }`, verifies UUID, checks duplicate |
| **GET** | `/api/attendance/session/<id>/` | Fetch live session summary, present/absent counts |
| **GET** | `/api/attendance/export/<id>/` | Download session attendance as a CSV file |
| **GET** | `/api/students/` | List and search students (filterable by branch, year, section) |

---

## 🧪 Running Automated Tests

Run the automated backend test suite:

```bash
cd backend
python test_section8_security.py
```
