# 🏢 Enterprise HRMS v2.0

> Geo-Fencing · Face Recognition · Smart Attendance · Auto Salary Deduction

---

## ⚡ Quick Start (3 Steps)

```bash
# Step 1 — Install all dependencies
cd hrms && npm run install:all

# Step 2 — Seed database (run ONCE)
npm run seed

# Step 3 — Start project
npm run dev
```

Open **http://localhost:3000**
Login: `admin@hrms.com` / `Admin@123`

---

## 📋 Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | v18 or higher | `node --version` |
| npm | v9 or higher | `npm --version` |
| Chrome/Edge | Latest | For webcam face scan |

---

## 📂 Project Structure

```
hrms/
├── package.json              ← Root: runs both together
├── server/
│   ├── .env                  ← ✅ MongoDB Atlas URI is already set here
│   ├── package.json
│   ├── index.js              ← Entry point
│   ├── app.js                ← Express setup
│   ├── config/db.js          ← MongoDB connection
│   ├── models/               ← All Mongoose models
│   ├── routes/               ← All API routes
│   ├── services/             ← Business logic
│   │   └── attendance.service.js  ← ⚠️ 10:45 AM threshold here ONLY
│   ├── middleware/           ← Auth + error handling
│   ├── cron/                 ← Scheduled jobs
│   └── scripts/seed.js       ← First-run seed
│
└── client/
    ├── package.json
    ├── public/
    │   ├── index.html
    │   └── models/           ← ⚠️ face-api.js models go here
    └── src/
        ├── App.jsx
        ├── pages/            ← Login, Dashboard, CheckIn, Salary, etc.
        ├── components/       ← Layout, ProtectedRoute
        ├── store/            ← Zustand (token in memory only)
        ├── utils/api.js      ← Axios + auto-refresh
        └── styles/index.css  ← Full CSS design system (no Tailwind)
```

---

## 🔧 Detailed Setup

### Step 1 — Install Dependencies

Open terminal, go to the `hrms` folder:

```bash
cd hrms
npm run install:all
```

This runs `npm install` in root, server, and client automatically.

**If it fails**, install manually:
```bash
npm install
cd server && npm install
cd ../client && npm install --legacy-peer-deps
```

---

### Step 2 — Check Your .env File

The file `server/.env` is already configured with your MongoDB Atlas connection:

```
MONGODB_URI=mongodb+srv://aditya:adityachoudhary@cluster0.t5o4pb5.mongodb.net/hrms_db?retryWrites=true&w=majority&appName=Cluster0
```

**Make sure MongoDB Atlas Network Access allows your IP:**
1. Go to https://cloud.mongodb.com
2. Login → your project → Security → **Network Access**
3. Click **+ ADD IP ADDRESS**
4. Click **ALLOW ACCESS FROM ANYWHERE** (adds 0.0.0.0/0)
5. Click **Confirm** → wait 1 minute

---

### Step 3 — Seed the Database (One Time Only)

```bash
cd hrms
npm run seed
```

**Expected output:**
```
✅ Connected to MongoDB
✅ Branch created: Head Office
✅ Department created: Human Resources (HR)
✅ Super Admin created:
   📧 Email:    admin@hrms.com
   🔑 Password: Admin@123
✅ Holidays: 4 created
🎉 SEED COMPLETE!
```

---

### Step 4 — Start the Project

**Option A — Both together (recommended):**
```bash
cd hrms
npm run dev
```

**Option B — Separately (if Option A fails):**

Terminal 1:
```bash
cd hrms/server
npm run dev
```

Terminal 2:
```bash
cd hrms/client
npm start
```

---

### Step 5 — Open Browser

- Frontend: **http://localhost:3000**
- Backend health check: **http://localhost:5000/api/health**

---

## 🔐 Default Login

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@hrms.com | Admin@123 |

> ⚠️ Change this password after first login!

---

## 👤 Face Recognition Setup (Required for Check-In)

Download model files (~6.5MB total) and place in `client/public/models/`:

**Download from:**
https://github.com/justadudewhohacks/face-api.js/tree/master/weights

**Files needed:**
```
client/public/models/
├── ssd_mobilenetv1_model-weights_manifest.json
├── ssd_mobilenetv1_model-shard1
├── ssd_mobilenetv1_model-shard2
├── face_landmark_68_model-weights_manifest.json
├── face_landmark_68_model-shard1
├── face_recognition_model-weights_manifest.json
├── face_recognition_model-shard1
└── face_recognition_model-shard2
```

**Quick download (run from project root):**
```bash
cd client/public && mkdir -p models && cd models
curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/ssd_mobilenetv1_model-weights_manifest.json
curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/ssd_mobilenetv1_model-shard1
curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/ssd_mobilenetv1_model-shard2
curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-weights_manifest.json
curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_landmark_68_model-shard1
curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-weights_manifest.json
curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-shard1
curl -O https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/face_recognition_model-shard2
```

---

## 🏢 First Things After Login

**1. Update branch GPS coordinates**

The seed creates a branch with Mumbai coordinates. Update to your actual office:
- Dashboard → (as Super Admin) use the API or DB to update branch lat/lon
- Get coordinates: Google Maps → right-click office location → copy coordinates
- Default GPS: 19.0760, 72.8777 (Mumbai)

**2. Create employee accounts**
- Go to **Employees** → **Add Employee**
- Set their gross salary (needed for salary slips)
- Default password: `Welcome@123`

**3. Enroll employee faces**
- Employee must be logged in on a machine with camera
- Admin calls: `POST /api/face/enroll/:employeeId` with 5 face descriptors
- After enrollment, employee can use face check-in

---

## 📅 Attendance Logic

### Time Thresholds

| Check-in Time | Employee Sees | Salary Deduction |
|--------------|---------------|-----------------|
| Before 9:45 AM | ✅ FULL DAY | None |
| 9:45 – 10:45 AM | ⚠️ HALF DAY | None (grace period) |
| After 10:45 AM | ⚠️ HALF DAY | 0.5 day deducted |
| No check-in | ❌ ABSENT | 1 day deducted |

> The 10:45 AM threshold is **never stored in .env or sent to the client**. It lives only in `server/services/attendance.service.js`.

### Salary Formula
```
Per Day = Gross Salary ÷ Days in Month
Deduction = (Real Half Days × 0.5 + Absent Days + Unpaid Leaves) × Per Day
Net Salary = Gross Salary − Deduction
```

### Automatic Cron Jobs

| Time | Job |
|------|-----|
| 00:05 AM daily | Mark Sundays as Weekly Off, holidays as Holiday |
| 11:59 PM daily | Auto-mark unchecked employees as Absent |
| 6:00 PM Mon–Sat | Auto-checkout employees still checked in |
| 1st of month 6 AM | Generate salary slips for previous month |

---

## 🔌 API Endpoints

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | `/api/auth/login` | Public | Login |
| POST | `/api/auth/refresh` | Cookie | Refresh token |
| POST | `/api/auth/logout` | Any | Logout |
| GET | `/api/auth/me` | Any | Own profile |
| GET | `/api/users` | Admin | All employees |
| POST | `/api/users` | Admin | Create employee |
| POST | `/api/attendance/checkin` | Employee | Check in |
| POST | `/api/attendance/checkout` | Employee | Check out |
| GET | `/api/attendance/today` | Employee | Today's record |
| GET | `/api/attendance/my` | Employee | Own history |
| GET | `/api/attendance` | Admin | All records |
| POST | `/api/face/enroll/:id` | Admin | Enroll face |
| POST | `/api/salary/generate` | Super Admin | Generate salary |
| GET | `/api/salary/my` | Employee | Own salary slip |
| POST | `/api/leaves` | Employee | Apply for leave |
| GET | `/api/analytics/dashboard` | Admin | Dashboard stats |

---

## 🔒 Security

- **Access token** — 15 min JWT, stored in Zustand memory (never localStorage)
- **Refresh token** — 7 day JWT, stored in httpOnly cookie (JS-inaccessible)
- **Face images** — never stored; only 128-dimension numerical descriptors saved
- **Liveness check** — blink detection (Eye Aspect Ratio) prevents photo replay
- **Geo-fence** — Haversine formula runs server-side only; client sends raw GPS
- **10:45 threshold** — hardcoded only in attendance.service.js, never in env or API

---

## ❗ Troubleshooting

### `querySrv ECONNREFUSED`
→ MongoDB Atlas is blocking your IP.
→ Go to Atlas → Network Access → Add `0.0.0.0/0` → Confirm → wait 2 min

### `react-scripts is not recognized`
→ Run `cd client && npm install --legacy-peer-deps`

### `authentication failed`
→ Wrong username/password in `server/.env` MONGODB_URI

### Face models not loading
→ Download model files to `client/public/models/` (see above)

### Camera permission denied
→ Allow camera in browser settings
→ Must be on `localhost` or `https` for camera to work

### Port 5000 in use
→ Change `PORT=5001` in `server/.env`

---

## ⏰ Cron on Render (or when the server sleeps)

On Render free tier the server can sleep, so **in-process cron (e.g. 11:59 PM auto-absent) may not run**. Two things are in place:

1. **Dashboard red block (Absent Today)** — The dashboard now counts "expected to work today but no attendance record" as absent, so the red block shows the right number even if cron didn’t run.
2. **HTTP cron trigger** — You can run the same jobs via HTTP so an external scheduler can call your app:
   - Set `CRON_SECRET` in Render (e.g. a long random string).
   - Call `POST /api/cron/trigger` with body `{ "secret": "<CRON_SECRET>", "job": "<job>" }` or GET `.../api/cron/trigger?secret=xxx&job=auto-absent`.
   - Jobs: `auto-absent` (11:59 PM), `holiday` (00:05), `eod` (11:30 PM Mon–Sat), `salary-gen`, `auto-remove-resigned`, `email-alerts`.
   - Use [Render Cron Jobs](https://render.com/docs/cron-jobs) or [cron-job.org](https://cron-job.org) to hit your backend URL at the right times (in your timezone).

---

## 🚀 API on Render & mobile face encoding

The backend exposes `POST /api/face/encode` (multipart field `image`). It loads TensorFlow face weights from disk — **the same files** as the web app uses under `client/public/models/`.

- **Monorepo deploy (recommended):** Point your Render service at this repo root and set the **start command** / root so the running process can read `client/public/models/` (e.g. repo includes both `server/` and `client/`). No extra env is needed.
- **API-only layout:** If `client/` is not on the server, copy that `models` folder onto the instance and set:

  `FACE_MODELS_DIR=/absolute/path/to/models`

  (folder must contain the `*_model-weights_manifest.json` files and shards).

The **`canvas`** npm package is a native addon; Render’s Node **Linux** environment usually installs it via prebuilds. If the build fails, check Render build logs for missing system libraries (rare on current stacks).

---

## Biometric attendance (HR + WebAuthn + mobile)

HR/Director/Super Admin enables **biometric attendance** per employee (Employees page). The employee then:

- **Mobile app:** taps **Enroll this device** once (uses device fingerprint / Face ID / PIN via `expo-local-authentication`), then checks in with the same.
- **Website:** registers a **passkey** once on the Check In page (browser uses Windows Hello / Touch ID / security key), then each check-in/out runs a WebAuthn assertion.

Set these on the **API** (Render) and ensure `CLIENT_URL` includes your Vercel origin:

```
WEBAUTHN_RP_NAME=Adiverse HRMS
WEBAUTHN_RP_ID=your-app.vercel.app
WEBAUTHN_ORIGIN=https://your-app.vercel.app,http://localhost:3000
```

`WEBAUTHN_RP_ID` must be the **hostname only** (no `https://`), matching the site where users open the portal.

---

## 🗂️ .env Reference

```
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000
MONGODB_URI=mongodb+srv://aditya:adityachoudhary@cluster0.t5o4pb5.mongodb.net/hrms_db?...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
BCRYPT_ROUNDS=12
CRON_SECRET=...          ← optional; for /api/cron/trigger when using external cron (e.g. Render)
FACE_MODELS_DIR=         ← optional; absolute path to face-api models if client/public/models is not present
WEBAUTHN_RP_NAME=        ← optional; passkey display name
WEBAUTHN_RP_ID=          ← required for web passkeys; hostname only (e.g. localhost or your Vercel domain)
WEBAUTHN_ORIGIN=         ← comma-separated allowed origins for WebAuthn (must include your Vercel URL)
OPENAI_API_KEY=          ← required for HRMS AI assistant (`/api/assistant/chat`); server-side only, never in Expo/Vercel public env
OPENAI_MODEL=gpt-4o-mini ← optional; default model for assistant
```

---

*Enterprise HRMS v2.0 — Built with Node.js, Express, MongoDB, React*
