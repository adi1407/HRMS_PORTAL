/**
 * Strong attendance verification: real biometrics only (fingerprint / Face ID),
 * not device screen PIN/passcode alone. Uses expo-local-authentication policies.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import type { LocalAuthenticationError, LocalAuthenticationResult } from 'expo-local-authentication';

/** True when running inside Expo Go (not a standalone / EAS / dev-client build). */
export function isExpoGoApp(): boolean {
  return Constants.appOwnership === 'expo';
}

/**
 * Human-readable message when authenticateAsync returns success: false.
 * Helps debug “Cancelled” vs sensor lockout vs user dismiss.
 */
export function getLocalAuthFailureMessage(result: LocalAuthenticationResult): string {
  if (result.success) return '';
  const err = result.error as LocalAuthenticationError;
  switch (err) {
    case 'user_cancel':
      return 'You cancelled the prompt. Tap Enroll again and complete Face ID / fingerprint.';
    case 'system_cancel':
    case 'app_cancel':
      return 'Authentication was interrupted. Close other apps using the camera/sensor and try again.';
    case 'authentication_failed':
      return 'Biometric did not match. Try again with your registered finger or face.';
    case 'lockout':
      return 'Too many failed attempts. Unlock the phone with your PIN once, wait a few seconds, then try again.';
    case 'not_available':
    case 'not_enrolled':
      return 'Biometrics are not set up. Add fingerprint or Face ID in Settings → Security.';
    case 'passcode_not_set':
      return 'Set a screen lock and enroll fingerprint or Face ID in device Settings.';
    case 'user_fallback':
      return 'Use Face ID or fingerprint (device PIN alone is not used for attendance).';
    default: {
      const code = String(err);
      // iOS + Expo Go: Face ID often fails without app-specific NSFaceIDUsageDescription
      if (Platform.OS === 'ios' && isExpoGoApp()) {
        return 'Expo Go on iPhone can’t use your app’s Face ID settings. Tap “Use Passcode” if shown, or install an EAS/dev build. Android works with Expo Go.';
      }
      if (Platform.OS === 'ios' && (code === 'unknown' || code.toLowerCase().includes('unknown'))) {
        return 'Biometrics failed on iPhone. Rebuild with EAS so Face ID is included, or use device passcode if offered.';
      }
      return `Could not verify. Try again or check Settings → Security. (${code})`;
    }
  }
}

export function getAttendanceBiometricOptions(promptMessage: string): LocalAuthentication.LocalAuthenticationOptions {
  const expoGoIos = isExpoGoApp() && Platform.OS === 'ios';
  return {
    promptMessage,
    cancelLabel: 'Cancel',
    /**
     * iOS production / dev-client: biometric-only (no passcode fallback).
     * Expo Go on iPhone: allow passcode fallback — Face ID often errors without app plist; user can use PIN.
     */
    disableDeviceFallback: !expoGoIos,
    /**
     * Android: use "weak" so phones with Class 2 (2D) face unlock still work.
     * iOS ignores this.
     */
    biometricsSecurityLevel: 'weak',
    requireConfirmation: false,
    /** Expo Go iOS: show “Use Passcode” so enrollment can complete without Face ID plist */
    fallbackLabel: expoGoIos ? 'Use Passcode' : Platform.OS === 'ios' ? '' : undefined,
  };
}

/**
 * Returns an error message if this device cannot meet strong biometric attendance, or null if OK.
 */
export async function getBiometricAttendanceReadinessError(): Promise<string | null> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    return 'This device has no fingerprint / Face ID hardware. Use a phone with biometrics for attendance, or ask HR to turn off biometric attendance for you.';
  }

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) {
    return 'Add fingerprint or Face ID in your phone settings (Settings → Security). A screen PIN or pattern alone is not accepted for attendance.';
  }

  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.length === 0) {
      return 'This device has no fingerprint or Face ID enrolled. Add biometrics in Settings → Security (a screen PIN alone is not enough).';
    }
  } catch {
    // Fall through — authenticateAsync will still enforce biometric policy.
  }

  return null;
}
