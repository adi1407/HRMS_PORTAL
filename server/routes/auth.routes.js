const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { login, refreshAccessToken, logout } = require('../services/auth.service');
const User = require('../models/User.model');
const { ApiError } = require('../utils/api.utils');

router.post('/login', async (req, res, next) => {
  try {
    const { email, password, lat, lon } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required.' });
    const result = await login({ email, password, lat, lon, req, res });
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const result = await refreshAccessToken({ req });
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.post('/logout', async (req, res, next) => {
  try {
    const result = await logout({ req, res });
    res.status(200).json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const u = await User.findById(req.user._id).select('+webAuthnCredentials');
    if (!u) return next(new ApiError(404, 'User not found.'));
    const data = u.toSafeObject();
    data.biometricAttendanceEnabled = !!u.biometricAttendanceEnabled;
    data.biometricMobileEnrolledAt = u.biometricMobileEnrolledAt || null;
    data.hasWebAuthnCredential = Array.isArray(u.webAuthnCredentials) && u.webAuthnCredentials.length > 0;
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * Mobile app: mark device biometric enrollment complete (after LocalAuthentication in app).
 * HR must have enabled biometricAttendanceEnabled first.
 */
router.post('/biometric-attendance/mobile-enroll', authenticate, async (req, res, next) => {
  try {
    const u = await User.findById(req.user._id);
    if (!u) return next(new ApiError(404, 'User not found.'));
    if (!u.biometricAttendanceEnabled) {
      return next(new ApiError(400, 'Biometric attendance is not enabled for your account. Ask HR to enable it first.'));
    }
    u.biometricMobileEnrolledAt = new Date();
    await u.save();
    res.json({ success: true, message: 'Mobile biometric enrollment saved. You can use fingerprint / device lock for check-in.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
