const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const { ApiError } = require('../utils/api.utils');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(new ApiError(401, 'Access token required. Please login.'));
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new ApiError(401, 'Access token expired. Please refresh.'));
      }
      return next(new ApiError(401, 'Invalid access token.'));
    }

    const user = await User.findById(decoded.userId)
      .populate('department', 'name')
      .populate('branch', 'name latitude longitude radiusMeters');

    if (!user || !user.isActive) {
      return next(new ApiError(401, 'User not found or deactivated.'));
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'Authentication required.'));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, `Access denied. Required: ${roles.join(' or ')}.`));
    }
    next();
  };
};

const selfOrAdmin = (req, res, next) => {
  const { user } = req;
  const targetId = req.params.employeeId || req.params.id || req.body.employeeId;
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return next();
  if (targetId && user._id.toString() === targetId.toString()) return next();
  return next(new ApiError(403, 'You can only access your own data.'));
};

module.exports = { authenticate, authorize, selfOrAdmin };
