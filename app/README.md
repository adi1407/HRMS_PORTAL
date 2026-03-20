# HRMS Mobile App

Apple-style React Native (Expo) app for the HRMS backend. Connects to the same API as the web client—login, dashboard, check-in/out, leave, salary, and profile.

## Connecting to your Render backend

The app talks to the **same backend as your Vercel website** (your Render API). No backend changes are required — Render already allows mobile requests (no-origin).

1. **Create a `.env` file** in this folder (`hrms-v3/app`), same level as `package.json`:

   ```bash
   EXPO_PUBLIC_API_URL=https://YOUR-RENDER-APP.onrender.com
   ```

   Replace `YOUR-RENDER-APP` with your actual Render service name (e.g. `hrms-api` → `https://hrms-api.onrender.com`). **No trailing slash and no `/api`** — the app adds `/api` itself.

2. **Restart Expo** after changing `.env`:
   ```bash
   npx expo start
   ```

3. **Optional (EAS / production builds):** Set `EXPO_PUBLIC_API_URL` in [EAS Environment Variables](https://docs.expo.dev/build-reference/variables/) for your production profile so builds use the Render URL.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
