# Connect iPhone to the dev server

## Two kinds of URLs

| What you run              | URL you get              | Use on iPhone                          |
|---------------------------|--------------------------|----------------------------------------|
| `npm run start` or `npm run start:tunnel` | **exp+hrms://...** (or exp://... if you press `s`) | **Development build** (HRMS app you installed via EAS) — open the HRMS app and it connects. |
| `npm run start:go`        | **exp://192.168.x.x:8081** | **Expo Go** — paste this URL in Safari; iOS will offer “Open in Expo Go”. |

The **http://IP:PORT** (e.g. `http://192.168.0.111:8082`) is the Metro bundler. You don’t open that in Safari to run the app; use the **exp://** or **exp+hrms://** URL.

---

## If you see exp+hrms:// and want exp:// (Expo Go)

- **Option A:** In the same terminal where the server is running, press **`s`** to switch to Expo Go. The URL will change to **exp://...** — copy that and paste it in Safari on your iPhone.
- **Option B:** Stop the server and run:
  ```bash
  npm run start:go
  ```
  The URL shown will be **exp://...** (with your laptop’s IP and port). Use that in Safari on the iPhone.

---

## Summary

- **Development build (installed HRMS app):** Keep **exp+hrms://...** — just open the HRMS app on the phone; it connects to the server.
- **Expo Go:** Use **exp://...** — run `npm run start:go` or press `s` after `npm run start`, then paste the **exp://** URL in Safari on the iPhone.
