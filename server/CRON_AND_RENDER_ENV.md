# Cron jobs and Render env reference

## All cron jobs (in code)

Defined in `server/cron/index.js`. Times are **server local** when run in-process; when using HTTP trigger, use your desired timezone in the external scheduler.

| # | Job name (HTTP trigger) | Schedule (cron) | When (server time) | What it does |
|---|--------------------------|-----------------|--------------------|---------------|
| 1 | `auto-absent` | `59 23 * * *` | 11:59 PM daily | Marks EMPLOYEE/HR/ACCOUNTS with no attendance for today as ABSENT. |
| 2 | `holiday` | `5 0 * * *` | 00:05 AM daily | Marks Sunday as WEEKLY_OFF, or today’s holiday as HOLIDAY, for EMPLOYEE/HR/ACCOUNTS/DIRECTOR. |
| 3 | `eod` | `30 23 * * 1-6` | 11:30 PM Mon–Sat | EOD evaluation: no checkout → ABSENT; re-evaluates full-day vs half-day from check-in/check-out. |
| 4 | `salary-gen` | `0 6 1 * *` | 6:00 AM on 1st of month | Generates salary records for **previous** month for all eligible employees. |
| 5 | `auto-remove-resigned` | `0 2 * * *` | 2:00 AM daily | Removes user accounts for resignations approved and reviewed ≥7 days ago. |
| 6 | `email-alerts` | `30 8 * * *` | 8:30 AM daily | Sends alert emails (birthdays, anniversaries, probation, leave balance, SLA, etc.). |

---

## Exact steps: HTTP cron trigger (when server sleeps on Render)

### Step 1 — Generate a secret

On your machine (PowerShell, Git Bash, or terminal):

```bash
# PowerShell (Windows)
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})

# Or use Node
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output (e.g. `a1b2c3d4e5...`). This is your **CRON_SECRET**. Keep it private.

---

### Step 2 — Add CRON_SECRET in Render

1. Go to [Render Dashboard](https://dashboard.render.com).
2. Open your **backend Web Service** (the Node/Express API).
3. Go to **Environment**.
4. Click **Add Environment Variable**.
5. **Key:** `CRON_SECRET`  
   **Value:** paste the secret you generated.
6. Save. Render will redeploy (or do a manual deploy).

---

### Step 3 — Call the cron endpoint on a schedule

Your backend URL is something like: `https://your-backend-name.onrender.com`  
The cron endpoint is: `https://your-backend-name.onrender.com/api/cron/trigger`

You must call it with:
- **GET (easiest):** `https://your-backend-name.onrender.com/api/cron/trigger?secret=YOUR_CRON_SECRET&job=JOB_NAME`
- **POST:** URL `https://your-backend-name.onrender.com/api/cron/trigger`, body JSON: `{"secret":"YOUR_CRON_SECRET","job":"JOB_NAME"}`

Use **one** of the options below.

---

#### Option A — cron-job.org (free, no extra Render service)

**Detailed walkthrough below** (see “cron-job.org — detailed steps”).

| Job name             | URL `job=` value       | When to run (example)     |
|----------------------|------------------------|----------------------------|
| auto-absent          | `auto-absent`          | Every day 23:59           |
| holiday              | `holiday`              | Every day 00:05           |
| eod                  | `eod`                  | Mon–Sat 23:30             |
| salary-gen           | `salary-gen`           | 1st of month 06:00        |
| auto-remove-resigned | `auto-remove-resigned` | Every day 02:00           |
| email-alerts         | `email-alerts`         | Every day 08:30           |

---

### cron-job.org — detailed steps

Follow this exactly. You will create **6 separate cron jobs** (one per row in the table above).

---

#### 1. Account and timezone

1. Open **[cron-job.org](https://cron-job.org)** in your browser.
2. Click **Sign up** (or **Login** if you have an account). Complete sign up with email and password.
3. After login you see the **Dashboard** with a list of cron jobs (empty at first).
4. **Set your timezone** (so “23:59” is in your local time):
   - Click your **profile / account** (top right, e.g. your email or avatar).
   - Find **Settings** or **Account**.
   - Look for **Timezone** or **Time zone**.
   - Select your zone (e.g. **Asia/Kolkata** for IST). Save.
   - All schedules you set below will then be in this timezone.

---

#### 2. What you need before creating jobs

You must have:

- **Backend URL** — Your Render backend address, e.g. `https://hrms-api.onrender.com` (no trailing slash). Find it in Render: your Web Service → **Settings** or the URL shown at the top.
- **CRON_SECRET** — The exact value you set in Render under **Environment** → `CRON_SECRET`. Copy it from Render or from where you generated it.

The full URL for each job will look like:

```
https://YOUR-BACKEND-URL/api/cron/trigger?secret=YOUR_CRON_SECRET&job=JOB_NAME
```

Replace:

- `YOUR-BACKEND-URL` → e.g. `hrms-api.onrender.com` (no `https://` in the middle if the form adds it; see below).
- `YOUR_CRON_SECRET` → your actual secret (no spaces).
- `JOB_NAME` → one of: `auto-absent`, `holiday`, `eod`, `salary-gen`, `auto-remove-resigned`, `email-alerts`.

Example for the first job (auto-absent):

```
https://hrms-api.onrender.com/api/cron/trigger?secret=mySecretKey123abc&job=auto-absent
```

---

#### 3. Create the first cron job (auto-absent)

1. On cron-job.org dashboard, click **Create cron job** (or **+ Cron job** / **New**).
2. You’ll see a form. Fill it like this:

| Field | What to enter |
|--------|----------------|
| **Title** | `HRMS auto-absent` (or any name you’ll recognise). |
| **Address (URL)** | Paste the full URL. Example: `https://hrms-api.onrender.com/api/cron/trigger?secret=YOUR_CRON_SECRET&job=auto-absent` |
| **Request method** | Select **GET**. |
| **Schedule** | Choose “Every day” and set time to **23:59** (11:59 PM in your set timezone). |

3. **URL notes:**
   - The whole URL must be in one line (no line breaks).
   - `secret` and `job` are query parameters; they must match exactly what your backend expects: `secret` = your CRON_SECRET, `job` = `auto-absent`.
   - If the form has a separate “Query parameters” section, you can instead set URL to `https://hrms-api.onrender.com/api/cron/trigger` and add parameters: `secret` = your secret, `job` = `auto-absent`.

4. Do **not** enable “Save response” or “Notify on failure” unless you want that; default is fine.
5. Click **Save** or **Create**. The first job is done.

---

#### 4. Create the remaining 5 jobs

Repeat the same process for each row below. Each time: **Create cron job** → fill **Title**, **URL** (with the correct `job=` value), **Method: GET**, and **Schedule** as in the table.

| # | Title (example) | job= in URL | Schedule |
|---|------------------|-------------|----------|
| 1 | HRMS auto-absent | `job=auto-absent` | Every day, **23:59** |
| 2 | HRMS holiday | `job=holiday` | Every day, **00:05** |
| 3 | HRMS eod | `job=eod` | **Monday–Saturday** only, **23:30** |
| 4 | HRMS salary-gen | `job=salary-gen` | **1st day of month**, **06:00** |
| 5 | HRMS auto-remove-resigned | `job=auto-remove-resigned` | Every day, **02:00** |
| 6 | HRMS email-alerts | `job=email-alerts` | Every day, **08:30** |

- For **eod**: in the schedule options, select “Weekdays” or “Monday–Saturday” (not Sunday), time 23:30.
- For **salary-gen**: select “Monthly” or “First day of month”, time 06:00.

Use the **same** `secret=` in all 6 URLs; only `job=` changes.

---

#### 5. Double-check the URL

Each URL must look like this (with your real values):

```
https://YOUR-BACKEND-NAME.onrender.com/api/cron/trigger?secret=YOUR_CRON_SECRET&job=JOB_NAME
```

- No space before or after `=`.
- `job` values are exactly: `auto-absent`, `holiday`, `eod`, `salary-gen`, `auto-remove-resigned`, `email-alerts` (lowercase, hyphenated).

---

#### 6. How to verify it works

**On cron-job.org:**

1. Go to the **Dashboard** (list of cron jobs).
2. Each job has an **Execution history** or **Last run** / **Logs**. Click it.
3. After the scheduled time has passed, you should see a run with **HTTP 200** (or “Success”). If you see **401**, the `secret` is wrong or missing; if you see **404**, the backend URL or path is wrong.

**On Render:**

1. Open your **Web Service** on Render → **Logs**.
2. At the time you set (e.g. 23:59), you should see an HTTP request to `/api/cron/trigger`. There should be no “401 Unauthorized” in the response.

**Optional — test immediately (don’t wait for schedule):**

1. In cron-job.org, open one of the jobs (e.g. **HRMS email-alerts**).
2. Look for **Execute now** or **Run now** / **Test run**.
3. Click it. Within a few seconds, check:
   - cron-job.org: execution log shows **200**.
   - Render logs: request to `/api/cron/trigger` and no 401.

If you get **401**:

- The value in the URL `secret=...` must be **exactly** the same as the **CRON_SECRET** in Render (Environment). Check for extra spaces, missing characters, or wrong copy-paste. Update either the cron job URL or Render’s `CRON_SECRET` so they match.

---

#### Option B — Render Cron Job (separate service)

Render can run a **Cron Job** service that hits your web service. You need **one Cron Job per schedule** (so 6 services), or a small script.

1. In Render: **New +** → **Cron Job**.
2. Connect the same repo; same root or specify `server` if needed.
3. **Build Command:** `npm install` (or your server install).
4. **Command:** a shell command that calls your API. Replace `YOUR_BACKEND_URL` and `YOUR_CRON_SECRET` and `JOB_NAME` for each service:

```bash
curl -X POST "https://YOUR_BACKEND_URL.onrender.com/api/cron/trigger" \
  -H "Content-Type: application/json" \
  -d '{"secret":"YOUR_CRON_SECRET","job":"JOB_NAME"}'
```

5. **Schedule:** use Render’s cron syntax (same as standard cron). Examples:
   - `59 23 * * *` → 11:59 PM daily (for `auto-absent`)
   - `5 0 * * *` → 00:05 daily (for `holiday`)
   - `30 23 * * 1-6` → 11:30 PM Mon–Sat (for `eod`)
   - `0 6 1 * *` → 6:00 AM on 1st (for `salary-gen`)
   - `0 2 * * *` → 2:00 AM daily (for `auto-remove-resigned`)
   - `30 8 * * *` → 8:30 AM daily (for `email-alerts`)

6. Create **6 Cron Job services**, each with the same `curl` command but different `job` and **Schedule**.

Render Cron Jobs run in **UTC**. So if you want 11:59 PM **IST** (UTC+5:30), schedule `59 18 * * *` (18:29 UTC).

---

### Step 4 — Verify

After the first run (at the scheduled time), check:

- **cron-job.org:** Execution history shows 200 OK.
- **Render:** Web Service logs show a POST/GET to `/api/cron/trigger` and no 401.

If you get **401**, the `secret` in the URL or body does not match `CRON_SECRET` in Render. Fix the env var or the caller and try again.

---

## HTTP trigger (reference)

- **Endpoint:** `POST /api/cron/trigger` or `GET /api/cron/trigger?secret=...&job=...`
- **Job names:** `auto-absent`, `holiday`, `eod`, `salary-gen`, `auto-remove-resigned`, `email-alerts`

---

## Render env vars to set

### Required for app (not cron-specific)

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | `production` on Render. |
| `PORT` | Usually set by Render; override only if needed. |
| `MONGODB_URI` | MongoDB connection string. |
| `CLIENT_URL` | Frontend URL (e.g. `https://your-app.onrender.com`). |
| `JWT_ACCESS_SECRET` | Secret for access tokens. |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens. |
| `JWT_ACCESS_EXPIRY` | e.g. `15m`. |
| `JWT_REFRESH_EXPIRY` | e.g. `7d`. |
| `BCRYPT_ROUNDS` | e.g. `12`. |

### Required for HTTP cron trigger (Render / external cron)

| Variable | Purpose |
|----------|---------|
| `CRON_SECRET` | Secret sent when calling `/api/cron/trigger`; must match in the scheduler. |

### Required for email-alerts cron (and any email from app)

| Variable | Purpose |
|----------|---------|
| `EMAIL_USER` | SMTP login (e.g. Gmail address). |
| `EMAIL_PASS` | SMTP password / app password. |

Without `EMAIL_USER` and `EMAIL_PASS`, the `email-alerts` job will not send mail (transporter is null).

### Optional

| Variable | Purpose |
|----------|---------|
| `SEED_SECRET` | If you expose seed/test routes; keep disabled in production. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | For image uploads if used. |

---

## Checklist for Render

1. Set all **Required for app** env vars in Render dashboard.
2. If using **external cron** (recommended when server can sleep):
   - Set **`CRON_SECRET`** to a long random string (e.g. `openssl rand -hex 32`).
   - In Render Cron Jobs or cron-job.org, call `https://<your-backend>.onrender.com/api/cron/trigger` with `secret=<CRON_SECRET>` and `job=<name>` at the times above.
3. If you want **daily email alerts** to run:
   - Set **`EMAIL_USER`** and **`EMAIL_PASS`** (and **`CLIENT_URL`** for links in emails).
4. Ensure **MONGODB_URI** allows access from Render (e.g. Atlas Network Access 0.0.0.0/0 or Render IPs).
