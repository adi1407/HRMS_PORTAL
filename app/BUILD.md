# HealthDoc – iOS development build & install

## ✅ Done in project

- `npm install` and `npx expo install expo-dev-client` (dev client installed)
- **app.json**: `name` = "HealthDoc", `slug` = "healthdoc", `icon` = "./assets/icon.png", `ios.bundleIdentifier` = "com.aditya.healthdoc"
- **eas.json**: `development` profile (for installable dev build), `preview` and `production` for later

## Icon

- Use a **1024×1024 PNG** as the app icon.
- Put it at: **`./assets/icon.png`** (project root = `hrms-v3/app`).
- If you use another path, update `app.json` → `expo.icon` and any `expo.ios.icon` / `expo.android.adaptiveIcon` you use.

---

## STEP 1: EAS CLI (one time)

```bash
npm install -g eas-cli
eas login
```

Log in with your Expo account.

---

## STEP 2: Configure EAS Build (if needed)

If you haven’t run this before:

```bash
cd hrms-v3/app
eas build:configure
```

- Choose **iOS** when asked for platform.
- This will use/create the existing `eas.json` in the project.

---

## STEP 3: Build iOS app (development)

From the app folder (`hrms-v3/app`):

```bash
eas build -p ios --profile development
```

- Sign in with **Apple ID** when prompted.
- Approve **auto creation of certificates** (press YES).
- Wait ~10–15 minutes for the build.

---

## STEP 4: Install on your iPhone

1. When the build finishes, you’ll get a **QR code** and **link** in the terminal or on the EAS build page.
2. On your iPhone:
   - Open the link in **Safari** (not Chrome).
   - Follow the prompts to **install** the app.
3. Trust the developer certificate:
   - **Settings → General → VPN & Device Management**
   - Select your developer certificate → **Trust**.

The app will appear on the home screen with your icon and open like a normal app (no Expo Go required).

---

## STEP 5: Run the app with your dev server

1. Start the dev server:

   ```bash
   cd hrms-v3/app
   npx expo start --dev-client
   ```

2. Open the **HealthDoc** app you installed on your iPhone.
3. It will connect to your dev server (same Wi‑Fi, or tunnel if you use `tunnel` in Expo).

---

## Summary

| Step | Command / action |
|------|-------------------|
| EAS login | `eas login` |
| Configure (optional) | `eas build:configure` → iOS |
| Build iOS dev | `eas build -p ios --profile development` |
| Install on device | Open build link in Safari → Install → Trust in Settings |
| Dev server | `npx expo start --dev-client` → open app on phone |

After this, the app runs as a standalone installable app with your name and icon, and you develop using `npx expo start --dev-client`.
