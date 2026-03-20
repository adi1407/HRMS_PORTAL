const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const User = require('../models/User.model');
const { ApiError } = require('../utils/api.utils');
const {
  buildRegistrationOptions,
  verifyAndSaveRegistration,
  buildAuthenticationOptions,
} = require('../services/webauthn.service');

const router = express.Router();

/** Registration: register a passkey in this browser (after HR enabled biometric attendance). */
router.post('/register-options', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+webAuthnCredentials');
    if (!user) return next(new ApiError(404, 'User not found.'));
    if (!user.biometricAttendanceEnabled) {
      return next(new ApiError(400, 'Biometric attendance is not enabled for your account. Ask HR to enable it first.'));
    }
    const options = await buildRegistrationOptions(user);
    res.json({ success: true, data: options });
  } catch (err) {
    next(err);
  }
});

router.post('/register-verify', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+webAuthnCredentials');
    if (!user) return next(new ApiError(404, 'User not found.'));
    if (!user.biometricAttendanceEnabled) {
      return next(new ApiError(400, 'Biometric attendance is not enabled for your account.'));
    }
    await verifyAndSaveRegistration(user, req.body);
    res.json({ success: true, message: 'Passkey registered for web check-in.' });
  } catch (err) {
    next(new ApiError(400, err.message || 'WebAuthn registration failed.'));
  }
});

/** Authentication options before attendance check-in/out on web (fingerprint / device PIN unlock). */
router.post('/attendance-auth-options', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('+webAuthnCredentials');
    if (!user) return next(new ApiError(404, 'User not found.'));
    if (!user.biometricAttendanceEnabled) {
      return next(new ApiError(400, 'Biometric attendance is not enabled.'));
    }
    if (!(user.webAuthnCredentials || []).length) {
      return next(new ApiError(400, 'Register a passkey on this site first (Check In page).'));
    }
    const options = await buildAuthenticationOptions(user);
    res.json({ success: true, data: options });
  } catch (err) {
    next(err instanceof ApiError ? err : new ApiError(400, err.message || 'WebAuthn options failed.'));
  }
});

module.exports = router;
