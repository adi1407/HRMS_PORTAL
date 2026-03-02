const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { login, refreshAccessToken, logout } = require('../services/auth.service');

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

router.get('/me', authenticate, (req, res) => {
  res.status(200).json({ success: true, data: req.user.toSafeObject() });
});

module.exports = router;
