# 📘 SmartPass — System Architecture & Complete Guide

Ye document explain karta hai ki **SmartPass Attendance System** kaise kaam karta hai, kaun-kaun si libraries aur technologies use ho rahi hain, aur pura data flow kaise execute hota hai.

---

## 🏗️ 1. Overall System Architecture

SmartPass ek full-stack web application hai jo 3 main layers par kaam karta hai:

```
[ Frontend (React + Vite) ]
          ⬇️  (REST API calls with JWT Token via Axios)
[ Backend (Django + Django REST Framework) ]
          ⬇️  (SQL Queries via dj-database-url / psycopg2)
[ Database (Cloud PostgreSQL on Render) ]
```

---

## 💻 2. Frontend (Client-Side)

Frontend modern, fast aur responsive UI ke sath bana hai jo mobile, tablet aur desktop sabhi devices par seamlessly chalta hai.

### 📦 Key Frontend Libraries:
| Library Name | Version / Package | Kaam / Purpose |
| :--- | :--- | :--- |
| **React & React-DOM** | `^18.x` | UI components, reactive state management (hooks like `useState`, `useEffect`, `useRef`). |
| **Vite** | `^5.x` | Super-fast frontend build tool aur development server. |
| **Axios** | `axios` | Backend API ke sath HTTP requests (GET, POST, PUT, DELETE) handle karne ke liye. Request & Response interceptors ke through JWT token attach karta hai. |
| **Lucide React** | `lucide-react` | Saare sleek aur clean vector icons (QR scanner, trash, calendar, users, email, checkmarks). |
| **HTML5-QRCode** | `html5-qrcode` | Device ke camera (back/front camera) se real-time high-speed QR code scan karne ke liye. |
| **Canvas Confetti** | `canvas-confetti` | Successful pass dispatch aur milestone celebration animations ke liye. |
| **XLSX (SheetJS)** | `xlsx` | Attendance data aur Student list ko Excel (.xlsx) aur CSV format me export/import karne ke liye. |
| **Web Audio API (Native)**| Native Browser API | Scan hone par custom success beep, duplicate warning tone aur error sound synth karne ke liye (bina external mp3 file ke). |

### 🔑 Frontend Working Flow:
1. **Authentication & Session:**
   - Single unified login page: Username decide karta hai ki user ka role kya hoga:
     - `adminpass` ➡️ **Admin** (Events, Students, Passes, SMTP, Reports, Delete Day access)
     - `smartpass` ➡️ **Volunteer** (Focused Live QR Scanner with instant audio feedback)
   - Tokens `sessionStorage` me store hote hain — tab close hote hi automatic security logout ho jata hai.
2. **Scanner Engine:**
   - Continuous live camera feed QR tokens ko read karta hai.
   - Built-in duplicate scan prevention (2 second cooldown) taaki ek hi student do baar count na ho.
   - Haptic vibration + Audio tone + visual green/yellow flash alert instant feedback deta hai.
3. **Event & Multi-Day Manager:**
   - Academic conferences, bootcamps aur multi-day events create karta hai.
   - Har event ke andar individual lecture days (Day 1, Day 2, etc.) manage hote hain.
   - Har day ke samne dedicated `[▷ Scan]` aur `[🗑 Delete Day]` button hota hai.

---

## ⚙️ 3. Backend (Server-Side)

Backend **Python 3** aur **Django** par based robust REST API hai jo business logic, email dispatch aur security handle karta hai.

### 📦 Key Backend Libraries:
| Library Name | Package | Kaam / Purpose |
| :--- | :--- | :--- |
| **Django** | `Django>=5.0` | Core web framework, ORM (database models), admin portal aur security middleware. |
| **Django REST Framework** | `djangorestframework` | API endpoints, ModelViewSets, JSON serialization aur request validation ke liye. |
| **SimpleJWT** | `djangorestframework-simplejwt` | Secure JSON Web Tokens (Access Token & Refresh Token) authentication ke liye. |
| **Django CORS Headers** | `django-cors-headers` | Cross-Origin Resource Sharing manage karne ke liye taaki frontend secure tarike se API ko access kare. |
| **QRCode & Pillow (PIL)** | `qrcode[pil]`, `Pillow` | Har student aur event pass ke liye dynamic high-resolution PNG QR images generate karne ke liye. |
| **Whitenoise** | `whitenoise[brotli]` | Production me static files (CSS, JS, images) ko bina Nginx ke super-fast serve karne ke liye. |
| **Gunicorn** | `gunicorn` | WSGI production HTTP server jo multi-worker requests process karta hai. |
| **dj-database-url** | `dj-database-url` | `DATABASE_URL` environment variable se database connection automatically configure karne ke liye. |
| **Psycopg2** | `psycopg2-binary` | Python aur PostgreSQL database ke beech ka high-performance driver/adapter. |
| **Python-Dotenv** | `python-dotenv` | Secret keys, database URLs aur credentials ko `.env` se securely read karne ke liye. |

---

## 🗄️ 4. Database Architecture (PostgreSQL on Cloud)

Pehle local SQLite use ho raha tha jo redeploy hone par reset ho jata tha. Ab system **Managed PostgreSQL (`smartpass-db`)** se connected hai jo Render cloud par 24/7 permanently safe hai.

### 📊 Core Data Models:
1. **`User` (Django Auth):**
   - Stores users (`adminpass` as superuser, `smartpass` as volunteer).
2. **`Student`:**
   - Name, Email, Branch, Year, Section, Unique Token (UUID4), QR Image path.
3. **`Event`:**
   - Title, Description, Start Date, End Date, Status (Active/Completed).
4. **`AttendanceSession` (Lecture Day):**
   - Event (ForeignKey), Day Label (e.g., "Day 1"), Topic, Date, Is Active.
5. **`EventPass`:**
   - Student & Event linkage, Dedicated Unique Token for event check-in.
6. **`AttendanceRecord`:**
   - Student, Session, Timestamp, Status (PRESENT), Unique constraint (ek student ek session me ek hi baar mark hoga).
7. **`SMTPSetting` & `EmailLog`:**
   - Custom SMTP credentials (host, port, user, password, TLS) aur har sent email ka delivery log.

---

## 🔄 5. Complete Step-by-Step Workflow

### Step 1: Event & Days Setup
- Admin dashboard se Event banata hai (e.g., *"Aarambh"* from 2026-09-07 to 2026-09-18).
- Us event ke andar lecture days add karta hai (*Day 1*, *Day 2*, etc.). Agar koi day galat ban gaya toh **Delete Day** button se instant remove kiya ja sakta hai.

### Step 2: Student Enrollment
- Admin CSV upload karta hai ya manually students add karta hai.
- Backend har student ke liye ek cryptographically secure UUID token aur QR image generate karta hai.

### Step 3: QR Pass Dispatch via Email
- Admin *"Passes"* section me jakar ek click me sabhi enrolled students ko unka personalized Event Pass email bhejta hai.
- Email me branded banner, student details aur scan hone wala QR code embedded hota hai.

### Step 4: Live Check-in (Volunteer / Admin)
- Volunteer ya Admin mobile camera ya laptop webcam se Live Scanner kholta hai.
- Scanner dropdown se Event aur Day select karta hai (e.g. *Aarambh* ➡️ *Day 1*).
- Student apna QR code camera ke aage dikhata hai:
  - Backend token verify karta hai ➡️ Student ka naam & details screen par popup hoti hain ➡️ Audio beep bajta hai ➡️ Attendance database me record ho jati hai.
  - Duplicate scan aane par warning yellow beep bajti hai.

### Step 5: Reports & Analytics
- **Matrix Report:** Pura tabular grid jisme rows me Students aur columns me Day 1, Day 2, Day 3 dikhte hain.
- Overall attendance percentage calculate hoti hai.
- Single-click **Excel / CSV download** available hai.

---

## 🌐 6. Deployment & 24/7 Keepalive

- **Hosting Platform:** Render (Web Service: `smart-pass-ub9z.onrender.com`).
- **Database:** Render Cloud PostgreSQL (`smartpass-db`).
- **Keepalive Engine:** **UptimeRobot** configured (har 5 minute me ping bhejta hai taaki Render Free tier ka server sleep mode me na jaye).
- **Auto CI/CD:** GitHub repo (`yamankumar-01/smart_pass`) ke `main` branch par push hote hi Render automatically zero-downtime build deploy kar deta hai.

---

*Authored for Yaman Kumar — SmartPass QR Attendance System*
