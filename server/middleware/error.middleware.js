const { ApiError } = require('../utils/api.utils');

const errorHandler = (err, req, res, next) => {
  let error = err;

  if (err.name === 'CastError') error = new ApiError(400, `Invalid ID: ${err.value}`);
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    error = new ApiError(400, messages.join('. '));
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error = new ApiError(409, `${field} already exists.`);
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error.';

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[ERROR] ${statusCode} — ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(error.errors?.length && { errors: error.errors }),
  });
};

module.exports = { errorHandler };
