# API URL in release builds (EAS APK / AAB)

## Why the installed app showed “Network error”

The repo root **`.gitignore`** includes **`.env`**, so **`app/.env` is not uploaded** to EAS Build.  
Metro then had **no** `EXPO_PUBLIC_API_URL` during the cloud build → the app fell back to **`http://localhost:5000`** → on a **phone**, that is wrong → **network error**.

## Fix (already applied)

`EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_CLIENT_URL` are set in **`eas.json`** under each build profile’s **`env`** block so they are always present at build time.

## When you change the API URL

1. Update **`eas.json`** → `env.EXPO_PUBLIC_API_URL` (and client URL if needed).  
2. Optionally keep **`app/.env`** in sync for local `expo start`.  
3. **Rebuild** the app:  
   `npx eas-cli build -p android --profile preview`

## Check that the URL is your **backend**

Open in a browser (or `curl`):

`https://YOUR-HOST.onrender.com/api/...`  

If that host only serves the **website** and not Express `/api`, pick your **API** service URL on Render instead.
