/**
 * API base URL for HRMS backend.
 * Set EXPO_PUBLIC_API_URL in .env — see .env.example and DEV-ANYWHERE.md.
 * Cloud URL (e.g. Render) works from any location; for local API run `npm run dev:ip` after changing Wi‑Fi.
 */
export const API_BASE_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
  'http://localhost:5000';

export const API_URL = `${API_BASE_URL.replace(/\/$/, '')}/api`;
