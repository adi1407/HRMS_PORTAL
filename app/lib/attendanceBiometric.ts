/**
 * Strong attendance verification: real biometrics only (fingerprint / Face ID),
 * not device screen PIN/passcode alone. Uses expo-local-authentication policies.
 */
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { SecurityLevel } from 'expo-local-authentication';

export function getAttendanceBiometricOptions(promptMessage: string): LocalAuthentication.LocalAuthenticationOptions {
  return {
    promptMessage,
    cancelLabel: 'Cancel',
    /** iOS: LAPolicyDeviceOwnerAuthenticationWithBiometrics — no device passcode fallback */
    disableDeviceFallback: true,
    /** Android: Class 3 (strong) biometrics only — not weak 2D face unlock */
    biometricsSecurityLevel: 'strong',
    /** Android: extra confirmation where supported */
    requireConfirmation: true,
    /** iOS: hide “Enter Password” when empty (pairs with disableDeviceFallback) */
    fallbackLabel: Platform.OS === 'ios' ? '' : undefined,
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
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === SecurityLevel.NONE || level === SecurityLevel.SECRET) {
      return 'Attendance requires fingerprint or Face ID — not only a screen PIN. Add biometrics in your device settings.';
    }
  } catch {
    // If level API fails, strict authenticateAsync still enforces policy on most devices.
  }

  return null;
}
