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
const analyticsRoutes     = require("./routes/analytics.routes");
const salaryRequestRoutes = require("./routes/salaryRequest.routes");
const resignationRoutes   = require("./routes/resignation.routes");
const exportRoutes        = require("./routes/export.routes");
const documentRoutes      = require("./routes/document.routes");
const expenseClaimRoutes  = require("./routes/expenseClaim.routes");
const dailyTaskRoutes     = require("./routes/dailyTask.routes");
const announcementRoutes  = require("./routes/announcement.routes");
const ticketRoutes        = require("./routes/ticket.routes");
const assetRoutes         = require("./routes/asset.routes");

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
app.use("/api/analytics",      analyticsRoutes);
app.use("/api/salary-requests", salaryRequestRoutes);
app.use("/api/resignations",    resignationRoutes);
app.use("/api/export",          exportRoutes);
app.use("/api/documents",       documentRoutes);
app.use("/api/expense-claims",  expenseClaimRoutes);
app.use("/api/daily-tasks",     dailyTaskRoutes);
app.use("/api/announcements",   announcementRoutes);
app.use("/api/tickets",         ticketRoutes);
app.use("/api/assets",          assetRoutes);

/** Test email — protected by SEED_SECRET, hits your EMAIL_USER inbox */
app.get("/api/test-email", async (req, res) => {
  const secret = process.env.SEED_SECRET;
  if (!secret || req.query.secret !== secret) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  const { sendMail } = require("./utils/email.utils");
  try {
    await sendMail({
      to:      process.env.EMAIL_USER,
      subject: "Sangi HRMS — Test Email",
      html:    "<h2>Test email from Sangi HRMS</h2><p>If you see this, email is working correctly.</p>",
    });
    res.json({ success: true, message: `Test email sent to ${process.env.EMAIL_USER}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Health check */
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "HRMS API is running ✅",
    env: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

/** One-time seed endpoint — protected by SEED_SECRET env var */
app.get("/api/seed", async (req, res) => {
  const secret = process.env.SEED_SECRET;
  if (!secret || req.query.secret !== secret) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  try {
    const User       = require("./models/User.model");
    const Branch     = require("./models/Branch.model");
    const Department = require("./models/Department.model");
    const Holiday    = require("./models/Holiday.model");

    const results = [];

    // Branch
    let branch = await Branch.findOne({ name: "HR Branch" });
    if (!branch) {
      branch = await Branch.create({ name: "HR Branch", address: "Floor 1, HR Wing", floor: 1, latitude: 28.587, longitude: 77.315, radiusMeters: 30, isActive: true });
      results.push("Branch created: HR Branch");
    } else { results.push("Branch exists: HR Branch"); }

    // Department
    let dept = await Department.findOne({ code: "HR" });
    if (!dept) {
      dept = await Department.create({ name: "Human Resources", code: "HR", isActive: true });
      results.push("Department created: Human Resources");
    } else { results.push("Department exists: Human Resources"); }

    // Super Admin
    let admin = await User.findOne({ email: "admin@hrms.com" });
    if (!admin) {
      // Pass plain password — User model pre-save hook hashes it automatically
      await User.create({ employeeId: "EMP-0001", name: "Super Admin", email: "admin@hrms.com", password: "Admin@123", role: "SUPER_ADMIN", designation: "System Administrator", department: dept._id, branch: branch._id, joiningDate: new Date(), grossSalary: 0, isActive: true });
      results.push("Super Admin created — email: admin@hrms.com | password: Admin@123");
    } else { results.push("Super Admin already exists"); }

    // Holidays
    const year = new Date().getFullYear();
    const holidays = [
      { name: "Republic Day",     date: new Date(year, 0, 26), type: "NATIONAL" },
      { name: "Independence Day", date: new Date(year, 7, 15), type: "NATIONAL" },
      { name: "Gandhi Jayanti",   date: new Date(year, 9,  2), type: "NATIONAL" },
      { name: "Christmas Day",    date: new Date(year, 11, 25), type: "NATIONAL" },
    ];
    let holidaysCreated = 0;
    for (const h of holidays) {
      const exists = await Holiday.findOne({ name: h.name });
      if (!exists) { await Holiday.create(h); holidaysCreated++; }
    }
    results.push(`Holidays: ${holidaysCreated} created`);

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Reset admin password — protected by SEED_SECRET */
app.get("/api/reset-admin", async (req, res) => {
  const secret = process.env.SEED_SECRET;
  if (!secret || req.query.secret !== secret) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  try {
    const User = require("./models/User.model");
    const admin = await User.findOne({ email: "admin@hrms.com" }).select("+password");
    if (!admin) return res.status(404).json({ success: false, message: "admin@hrms.com not found — run /api/seed first" });
    admin.password = "Admin@123"; // plain — pre-save hook will hash it
    admin.markModified("password");
    await admin.save({ validateBeforeSave: false });
    res.json({ success: true, message: "Password reset to Admin@123" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** 404 */
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

/** Global error handler */
app.use(errorHandler);

module.exports = app;