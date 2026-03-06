// reset-admin.js

// server/app.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

// Routes
const authRoutes       = require("./routes/auth.routes");
const userRoutes       = require("./routes/user.routes");
const attendanceRoutes = require("./routes/attendance.routes");
const faceRoutes       = require("./routes/face.routes");
const salaryRoutes     = require("./routes/salary.routes");
const leaveRoutes      = require("./routes/leave.routes");
const branchRoutes     = require("./routes/branch.routes");
const departmentRoutes = require("./routes/department.routes");
const holidayRoutes    = require("./routes/holiday.routes");
const analyticsRoutes  = require("./routes/analytics.routes");

const { errorHandler } = require("./middleware/error.middleware");

const app = express();

/**
 * IMPORTANT:
 * Render/any reverse proxy needs trust proxy for correct IP/cookies etc.
 */
app.set("trust proxy", 1);

/** Security */
app.use(helmet());

/**
 * ✅ CORS that works on both LOCAL + RENDER
 *
 * Set CLIENT_URL in Render env like:
 * CLIENT_URL=https://your-frontend.vercel.app
 *
 * For local add:
 * CLIENT_URL=http://localhost:5173,http://localhost:3000
 *
 * It supports multiple origins separated by comma.
 */
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173,http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // allow requests with no origin (like curl, postman, mobile apps)
      if (!origin) return cb(null, true);

      // strip trailing slash — some browsers/tools append it
      const normalizedOrigin = origin.replace(/\/$/, '');
      if (allowedOrigins.includes(normalizedOrigin)) return cb(null, true);

      return cb(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);

/** Rate limiting */
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));
app.use("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));

/** Body parsing */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/** Logging */
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

/** Routes */
app.use("/api/auth",        authRoutes);
app.use("/api/users",       userRoutes);
app.use("/api/attendance",  attendanceRoutes);
app.use("/api/face",        faceRoutes);
app.use("/api/salary",      salaryRoutes);
app.use("/api/leaves",      leaveRoutes);
app.use("/api/branches",    branchRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/holidays",    holidayRoutes);
app.use("/api/analytics",   analyticsRoutes);

/** Health check */
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "HRMS API is running ✅",
    env: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

/** 404 */
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

/** Global error handler */
app.use(errorHandler);

module.exports = app;