# Develop from any location (changing Wi‑Fi / IP)

Your laptop’s **LAN IP changes** when you move (home → office → café). Two things must match that:

1. **Phone ↔ Metro (Expo)** — how the app loads JavaScript from your laptop  
2. **Phone ↔ HRMS API** — where `EXPO_PUBLIC_API_URL` points  

---

## 1. Expo / Metro (no fixed IP needed)

Use a **tunnel** so the phone does not need your current `192.168.x.x`:

```bash
npm run start:tunnel
```

- Works on **different Wi‑Fi** or **mobile data** on the phone.
- The QR / URL uses Expo’s tunnel, not your home IP.

**Expo Go + tunnel together** (good when IP/network keeps changing):

```bash
npm run start:anywhere
```

(`--tunnel` + `--go`)

If you use a **development build** (installed HRMS app), use:

```bash
npm run start:tunnel
```

and open the **HRMS** app; tunnel still avoids relying on a fixed LAN IP for Metro.

---

## 2. API URL (backend)

### Option A — Best when you move a lot (recommended)

Put your **deployed** API in `.env` (HTTPS). It does **not** depend on your laptop IP:

```env
EXPO_PUBLIC_API_URL=https://your-api.onrender.com
```

Copy from `.env.example`, restart Expo after changing `.env`.

### Option B — Local server on this laptop

1. Connect laptop to Wi‑Fi at the new place.  
2. Run:

   ```bash
   npm run dev:ip
   ```

3. Copy the printed line into `.env`:

   ```env
   EXPO_PUBLIC_API_URL=http://YOUR_CURRENT_IP:5000
   ```

4. **Restart** Expo (`Ctrl+C`, then `npm run start` or `npm run start:tunnel`).  
5. Phone must reach that IP → usually **same Wi‑Fi** as the laptop. If not, use Option A or expose the API with ngrok/cloudflare tunnel.

---

## Quick reference

| Situation | Expo command | API in `.env` |
|-----------|--------------|----------------|
| Same room, same Wi‑Fi, stable IP | `npm run start` | `http://<LAN-IP>:5000` from `npm run dev:ip` |
| Different place / phone on other network | `npm run start:tunnel` or `npm run start:anywhere` | Cloud `https://...` **or** tunnel your API |
| Expo Go + changing networks | `npm run start:anywhere` | Cloud URL preferred |

---

## Files

- **`.env.example`** — template for `EXPO_PUBLIC_API_URL`  
- **`scripts/print-dev-ip.js`** — current LAN IP for local API  
- **`CONNECT-IPHONE.md`** — `exp://` vs `exp+hrms://` URLs  
