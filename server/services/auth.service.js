const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const { createAuditLog } = require('../utils/auditLog.utils');
const { ApiError } = require('../utils/api.utils');

const generateAccessToken  = (userId, role) => jwt.sign({ userId, role }, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' });
const generateRefreshToken = (userId) => jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' });

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const login = async ({ email, password, lat, lon, req, res }) => {
  const user = await User.findOne({ email }).select('+password +refreshToken').populate('branch', 'name latitude longitude radiusMeters').populate('department', 'name');
  if (!user) throw new ApiError(401, 'Invalid email or password.');
  if (!user.isActive) throw new ApiError(403, 'Account deactivated. Contact HR.');

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    await createAuditLog({ actor: user, action: 'LOGIN_FAILED', severity: 'WARNING', req });
    throw new ApiError(401, 'Invalid email or password.');
  }

  const accessToken  = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
  const locationNote = (lat != null && lon != null) ? ` | GPS: ${parseFloat(lat).toFixed(5)}, ${parseFloat(lon).toFixed(5)}` : '';
  await createAuditLog({ actor: user, action: 'LOGIN_SUCCESS', description: `Login from IP ${req.ip}${locationNote}`, req });

  return { accessToken, user: user.toSafeObject() };
};

const refreshAccessToken = async ({ req }) => {
  const incomingToken = req.cookies?.refreshToken;
  if (!incomingToken) throw new ApiError(401, 'Refresh token not found. Please login.');

  let decoded;
  try {
    decoded = jwt.verify(incomingToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token. Please login.');
  }

  const user = await User.findById(decoded.userId).select('+refreshToken');
  if (!user || user.refreshToken !== incomingToken) {
    throw new ApiError(401, 'Refresh token mismatch. Please login.');
  }

  return { accessToken: generateAccessToken(user._id, user.role) };
};

const logout = async ({ req, res }) => {
  const incomingToken = req.cookies?.refreshToken;
  if (incomingToken) {
    try {
      const decoded = jwt.verify(incomingToken, process.env.JWT_REFRESH_SECRET);
      await User.findByIdAndUpdate(decoded.userId, { refreshToken: null });
    } catch {}
  }
  res.clearCookie('refreshToken', { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
  return { message: 'Logged out successfully.' };
};

module.exports = { login, refreshAccessToken, logout };
