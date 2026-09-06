# 🚀 Deployment Guide: Smart Attendance QR Management System

This project is configured for **All-in-One Cloud Container Deployment** using Docker. The single container runs both the **React + Vite Frontend (SPA)** and the **Django 5.x REST API + SQLite/PostgreSQL Database** on a single URL.

---

## Option 1: 1-Click Deployment on Render.com (Recommended Free Cloud)

Render allows you to deploy this Dockerized app directly from GitHub.

### Step 1: Push your project to GitHub
1. Initialize git and commit your files:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Smart Attendance QR System"
   ```
2. Create a new repository on [GitHub](https://github.com/new).
3. Link and push your repository:
   ```bash
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy on Render
1. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** -> **Web Service**.
2. Connect your GitHub repository.
3. Choose **Docker** as the runtime.
4. Render will automatically detect the [Dockerfile](./Dockerfile) and [render.yaml](./render.yaml).
5. Add the following **Environment Variables** under Environment tab:
   - `DEBUG` = `False`
   - `SECRET_KEY` = *(generate any random 50-character string)*
   - `ALLOWED_HOSTS` = `*`
   - `CORS_ALLOW_ALL_ORIGINS` = `True`
6. Click **Deploy Web Service**!
7. Once the build finishes (approx. 2 minutes), Render will give you a live URL like `https://qr-attendance-xxxx.onrender.com`.

---

## Option 2: Deploy on Railway.app

1. Go to [Railway.app](https://railway.app/) and create a new project.
2. Select **Deploy from GitHub repo** and choose your repository.
3. Railway automatically detects `Dockerfile` and `railway.json`.
4. Under **Variables**, add:
   - `PORT` = `8000` (or leave Railway default)
   - `DEBUG` = `False`
   - `SECRET_KEY` = `your-secure-random-secret-key`
   - `ALLOWED_HOSTS` = `*`
5. Click **Deploy**. Under service Settings, click **Generate Domain** to get your public HTTPS URL!

---

## Option 3: Deploy on Fly.io

1. Install the `flyctl` CLI: [Fly.io install guide](https://fly.io/docs/hands-on/install-flyctl/).
2. Login to your account:
   ```bash
   fly auth login
   ```
3. Launch and deploy:
   ```bash
   fly launch
   fly deploy
   ```

---

## Option 4: Run Locally or on VPS with Docker Compose

If you have Docker Desktop or an Ubuntu/Debian VPS (DigitalOcean, Linode, AWS EC2):

1. Clone or copy your repository to the server.
2. Run with Docker Compose:
   ```bash
   docker compose up --build -d
   ```
3. Open your browser at `http://localhost:8000` (or `http://<your-server-ip>:8000`).

---

## 🛠️ Configuration & Secrets

| Environment Variable | Recommended Value | Description |
| :--- | :--- | :--- |
| `DEBUG` | `False` | Disables debug mode in production |
| `SECRET_KEY` | *(Random 50+ chars)* | Django cryptographic signing key |
| `ALLOWED_HOSTS` | `*` or your custom domain | Allowed HTTP Host headers |
| `CORS_ALLOW_ALL_ORIGINS` | `True` | Allows cross-origin API requests |
| `DATABASE_URL` | *(Optional)* | PostgreSQL connection string (defaults to SQLite if omitted) |

---

## 📧 SMTP Email Setup in Production
Once deployed:
1. Log into your live application.
2. Navigate to **SMTP Settings** in the top navigation bar.
3. Enter your SMTP credentials (e.g. Gmail App Password, SendGrid, Amazon SES, or Mailgun).
4. Send a test email pass directly from the live dashboard!
