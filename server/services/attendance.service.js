// ⚠️  SECURITY: Real deduction threshold is hardcoded here ONLY.
// NEVER store in .env, frontend, or API responses.

const Attendance = require('../models/Attendance.model');
const Branch     = require('../models/Branch.model');
const Salary     = require('../models/Salary.model');
const { isWithinGeoFence }    = require('../utils/geo.utils');
const { verifyFace }          = require('./face.service');
const { createAuditLog }      = require('../utils/auditLog.utils');
const { ApiError }            = require('../utils/api.utils');
const { generateMonthlySalary } = require('./salary.service');

// Check-in after 12:00 PM → HALF_DAY (regardless of checkout time)
const LATE_CHECKIN_MINS = 12 * 60;    // noon

// Checkout before 4:00 PM → HALF_DAY (when check-in was on time)
const EARLY_CHECKOUT_MINS = 16 * 60;  // 4:00 PM

const processCheckIn = async ({ employeeId, branchId, faceDescriptor, lat, lon, req }) => {

  // Step 1: Office network (WiFi public IP) check
  const branch = await Branch.findById(branchId);
  if (!branch || !branch.isActive) throw new ApiError(404, 'Branch not found.');

  if (branch.allowedIPs && branch.allowedIPs.length > 0) {
    const rawIP    = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '';
    const clientIP = rawIP.replace(/^::ffff:/, '');
    const isDev    = process.env.NODE_ENV !== 'production';
    const isLocal  = isDev && ['127.0.0.1', '::1', 'localhost', ''].includes(clientIP);
    const isAllowed = branch.allowedIPs.some(entry => clientIP === entry || clientIP.startsWith(entry));
    console.log(`[IP CHECK] clientIP="${clientIP}" allowedIPs=${JSON.stringify(branch.allowedIPs)} isAllowed=${isAllowed} isDev=${isDev} isLocal=${isLocal}`);
    if (!isLocal && !isAllowed) {
      await createAuditLog({ actor: { _id: employeeId }, action: 'CHECK_IN_DENIED_NETWORK', severity: 'WARNING', description: `IP ${clientIP} not in allowed list for branch "${branch.name}"`, req });
      throw new ApiError(403, 'Please connect to the office WiFi network to check in.');
    }
  }

  // Step 2: Geo-fence check (only if branch has coordinates configured)
  if (branch.latitude || branch.longitude) {
    if (lat == null || lon == null) {
      throw new ApiError(400, 'Location access is required. Please enable GPS and try again.');
    }
    const geo = isWithinGeoFence(parseFloat(lat), parseFloat(lon), branch);
    if (!geo.allowed) {
      await createAuditLog({ actor: { _id: employeeId }, action: 'CHECK_IN_DENIED_LOCATION', severity: 'WARNING', description: `${geo.distance}m from office (limit: ${geo.radiusMeters}m)`, req });
      throw new ApiError(403, `You are ${geo.distance}m from the office. Must be within ${geo.radiusMeters}m to check in.`);
    }
  }

  // Step 3: Face recognition
  const faceResult = await verifyFace(employeeId, faceDescriptor);
  if (!faceResult.matched) {
    await createAuditLog({ actor: { _id: employeeId }, action: 'CHECK_IN_DENIED_FACE', severity: 'WARNING', description: `Distance: ${faceResult.distance}`, req });
    throw new ApiError(401, 'Face not recognized. Please ensure good lighting and try again.');
  }

  // Step 4: Duplicate check
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const existing = await Attendance.findOne({ employee: employeeId, date: todayStart });
  if (existing?.checkIn) throw new ApiError(409, 'Already checked in today.');

  // Step 5: Time-based status — check-in after 12:00 PM → HALF_DAY
  const now       = new Date();
  const totalMins = now.getHours() * 60 + now.getMinutes();

  let status        = 'FULL_DAY';
  let isRealHalfDay = false;
  let displayStatus = 'FULL_DAY';

  if (totalMins > LATE_CHECKIN_MINS) {
    status = 'HALF_DAY';
    isRealHalfDay = true;
    displayStatus = 'HALF_DAY';
  }

  // Step 6: Save
  const checkInTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const attendance = await Attendance.findOneAndUpdate(
    { employee: employeeId, date: todayStart },
    {
      checkIn: now, checkInTime,
      status, displayStatus, isRealHalfDay,
      faceConfidence: faceResult.confidence,
      markedBy: 'SYSTEM',
    },
    { new: true, upsert: true }
  );

  await createAuditLog({ actor: { _id: employeeId }, action: 'CHECK_IN_SUCCESS', entity: 'Attendance', entityId: attendance._id, description: `Check-in at ${checkInTime}`, req });

  // Return ONLY displayStatus — never the real status
  return {
    checkInTime,
    displayStatus,
    message: isRealHalfDay
      ? 'Checked in. Marked as Half Day.'
      : displayStatus === 'HALF_DAY'
        ? 'Checked in. Note: You are late today.'
        : 'Checked in successfully. Have a productive day!',
  };
};

const processCheckOut = async ({ employeeId, branchId, faceDescriptor, lat, lon, req }) => {
  const branch = await Branch.findById(branchId);
  if (!branch || !branch.isActive) throw new ApiError(404, 'Branch not found.');

  // Office network check
  if (branch.allowedIPs && branch.allowedIPs.length > 0) {
    const rawIP    = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '';
    const clientIP = rawIP.replace(/^::ffff:/, '');
    const isDev    = process.env.NODE_ENV !== 'production';
    const isLocal  = isDev && ['127.0.0.1', '::1', 'localhost', ''].includes(clientIP);
    const isAllowed = branch.allowedIPs.some(entry => clientIP === entry || clientIP.startsWith(entry));
    if (!isLocal && !isAllowed) {
      throw new ApiError(403, 'Please connect to the office WiFi network to check out.');
    }
  }

  // Geo-fence check (only if branch has coordinates configured)
  if (branch.latitude || branch.longitude) {
    if (lat == null || lon == null) {
      throw new ApiError(400, 'Location access is required. Please enable GPS and try again.');
    }
    const geo = isWithinGeoFence(parseFloat(lat), parseFloat(lon), branch);
    if (!geo.allowed) {
      throw new ApiError(403, `You are ${geo.distance}m from the office. Must be within ${geo.radiusMeters}m to check out.`);
    }
  }

  const faceResult = await verifyFace(employeeId, faceDescriptor);
  if (!faceResult.matched) throw new ApiError(401, 'Face not recognized. Check-out denied.');

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const attendance = await Attendance.findOne({ employee: employeeId, date: todayStart });
  if (!attendance?.checkIn) throw new ApiError(400, 'No check-in found for today.');
  if (attendance.checkOut)  throw new ApiError(409, 'Already checked out today.');

  const now          = new Date();
  const checkoutMins = now.getHours() * 60 + now.getMinutes();
  const workingHours = parseFloat(((now - attendance.checkIn) / (1000 * 60 * 60)).toFixed(2));
  const checkOutTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  // Checkout before 4:00 PM and was on track for full day → downgrade to HALF_DAY
  const earlyLeave   = checkoutMins < EARLY_CHECKOUT_MINS && attendance.status === 'FULL_DAY';
  const updateFields = { checkOut: now, checkOutTime, workingHours };
  if (earlyLeave) {
    updateFields.status        = 'HALF_DAY';
    updateFields.displayStatus = 'HALF_DAY';
    updateFields.isRealHalfDay = true;
  }

  await Attendance.findByIdAndUpdate(attendance._id, updateFields);

  return {
    checkOutTime, workingHours,
    message: earlyLeave
      ? `Checked out early. Marked as Half Day. You worked ${workingHours} hours.`
      : `Checked out. You worked ${workingHours} hours today. 👋`,
  };
};

const getTodayAttendance = async (employeeId) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return Attendance.findOne(
    { employee: employeeId, date: todayStart },
    { status: 0, isRealHalfDay: 0, faceConfidence: 0 } // Safe projection
  );
};

const overrideAttendance = async ({ attendanceId, status, notes, admin }) => {
  if (!notes || !notes.trim()) throw new ApiError(400, 'Reason is required when overriding attendance.');
  const displayMap = { FULL_DAY: 'FULL_DAY', HALF_DAY: 'HALF_DAY', ABSENT: 'ABSENT', ON_LEAVE: 'ON_LEAVE', HOLIDAY: 'FULL_DAY', WEEKLY_OFF: 'FULL_DAY' };
  const attendance = await Attendance.findByIdAndUpdate(
    attendanceId,
    { status, displayStatus: displayMap[status], isRealHalfDay: status === 'HALF_DAY', markedBy: admin.role, overriddenByName: admin.name, notes: notes.trim() },
    { new: true }
  );
  if (!attendance) throw new ApiError(404, 'Attendance record not found.');
  await createAuditLog({ actor: admin, action: 'ATTENDANCE_OVERRIDE', entity: 'Attendance', entityId: attendance._id, description: `Changed to ${status} — ${notes.trim()}`, severity: 'WARNING' });

  // Auto-recalculate salary if a DRAFT slip exists for this month
  const month = attendance.date.getMonth() + 1;
  const year  = attendance.date.getFullYear();
  const existingSalary = await Salary.findOne({ employee: attendance.employee, month, year });
  if (existingSalary?.status === 'DRAFT') {
    await generateMonthlySalary(attendance.employee, month, year, admin);
    return { attendance, salaryRecalculated: true };
  }
  const salaryWarning = existingSalary?.status === 'FINAL'
    ? 'Salary slip is already finalized. Deductions not auto-updated.' : null;
  return { attendance, salaryWarning };
};

module.exports = { processCheckIn, processCheckOut, getTodayAttendance, overrideAttendance };
