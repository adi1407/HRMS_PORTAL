# How to set the API URL and rebuild the Android APK

## 1. Find your **backend** URL on Render

1. Log in to **[dashboard.render.com](https://dashboard.render.com)**.
2. Open the **Web Service** that runs your **Node/Express** HRMS **server** (not the static React/Vite site unless they are the same service).
3. At the top you’ll see the public URL, e.g. `https://something.onrender.com`.
4. **Test it:** in a browser (phone or PC), open:

   `https://YOUR-SERVICE.onrender.com/api/health`

   - You should get **JSON** (e.g. `{ "status": "ok" }` or similar).
   - If you get **404** from a **React app** only, or the page never loads, that URL is **wrong** for the API — pick the service where **`server/index.js`** (or your API) is deployed.

Copy the base URL **without** `/api` and **without** a trailing slash  
Example: `https://hrms-api-xxxx.onrender.com`

---

## 2. Put that URL in `eas.json`

Edit **`app/eas.json`** and set the same value in **every** `env` block you use for builds (`development`, `preview`, `production`):

```json
"env": {
  "EXPO_PUBLIC_API_URL": "https://YOUR-BACKEND.onrender.com",
  "EXPO_PUBLIC_CLIENT_URL": "https://your-web-app.vercel.app"
}
```

- **`EXPO_PUBLIC_API_URL`** — backend only (Express).
- **`EXPO_PUBLIC_CLIENT_URL`** — optional; used for web links in the app.

Also update **`app/.env`** with the same `EXPO_PUBLIC_*` values for **local** `expo start` (optional but keeps dev in sync).

---

## 3. Rebuild the Android APK (EAS)

In PowerShell:

```powershell
cd c:\Users\adity\Documents\hrms-v3-final\hrms-v3\app
npx eas-cli build -p android --profile preview --non-interactive
```

Wait until the build is **Finished** on [expo.dev](https://expo.dev), then:

```powershell
npx eas-cli build:list --platform android --limit 1
```

Copy **Application Archive URL** (the `.apk` link), download on your phone, install (replace old app).

---

## 4. Confirm on the phone

- After login screen changes ship, the app shows **Server: …** at the bottom — it must match your Render API base.
- Open **`https://YOUR-BACKEND.onrender.com/api/health`** in Chrome on the phone before testing login.

---

## Why not only `.env`?

- **`.env`** is ignored by git and often **not** uploaded to EAS; **`eas.json` `env`** is what EAS injects at **build** time.
- The **installed APK** does **not** read `.env` from your PC — it only contains what was baked in at build.
