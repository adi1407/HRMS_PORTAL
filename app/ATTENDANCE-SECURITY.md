# Attendance security (what the app enforces + what HR can add)

## What the mobile app enforces now

1. **GPS** — Location is sent with check-in/out (backend validates against branch rules).
2. **Office WiFi** — If the branch lists SSIDs, the employee must pick the network they’re on.
3. **Strong biometrics (when HR enables “biometric attendance”)**  
   - **Fingerprint / Face ID (or equivalent strong biometrics)** — not **device screen PIN/passcode alone**.  
   - **iOS:** Biometric policy without device passcode fallback (`disableDeviceFallback`).  
   - **Android:** **Strong** biometric class only (`biometricsSecurityLevel: 'strong'`), not weak 2D face unlock.  
4. **Per-employee opt-in** — HR enables biometric attendance per user; each user enrolls on **their own** device.

## Other strong measures (process + infrastructure)

| Measure | Notes |
|--------|--------|
| **Web check-in: WebAuthn** | Browser uses passkeys / platform authenticators with **user verification required** (see server `webauthn` routes). |
| **Tight geo-fences** | Ensure branch coordinates + radius in admin match real office boundaries. |
| **WiFi SSID list** | Keep branch SSIDs accurate so “at office network” is meaningful. |
| **Policies** | Written policy: attendance only on company-approved phones; report lost devices. |
| **Audits** | Use existing audit / attendance reports to spot impossible travel or duplicate devices. |
| **Optional future tech** | Office BLE beacons, NFC checkpoints, or dedicated time clocks — not in the default mobile flow. |

## Why PIN alone isn’t used for biometric attendance

Screen PIN is easy to share or observe. The app therefore requires **in-device biometric templates** (fingerprint / Face ID) where HR has turned biometric attendance on, aligned with common enterprise practice.
