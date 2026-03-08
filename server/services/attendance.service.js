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

// ─── Attendance Time Rules ───────────────────────────────────────────────────
// Full Day   : check-in ≤ 10:00 AM  AND  checkout ≥ 6:00 PM AND worked ≥ 4 h
// Late+Full  : check-in 10:01–1:00 PM AND checkout ≥ 6:00 PM AND worked ≥ 4 h
// Half Day   : check-in after 1:00 PM AND worked ≥ 4 h (locked, checkout can't upgrade)
// Half Day   : checkout before 4:30 PM AND worked ≥ 4 h (early leave)
// Half Day   : checkout 4:30–6:00 PM AND worked ≥ 4 h (incomplete shift)
// Absent     : worked < 4 hours (regardless of check-in/out times)
// Absent     : only check-in with no checkout by 6:00 PM (single entry = no credit)
// Absent     : no check-in at all (cron marks at 11:59 PM)
// Grace      : 10:01–10:10 AM → treated as on-time, noted only

const ON_TIME_CHECKIN   = 10 * 60;       // 10:00 AM
const GRACE_END         = 10 * 60 + 10;  // 10:10 AM — 10-min grace window
const HALFDAY_CHECKIN   = 13 * 60;       // 1:00 PM  — after this = instant HALF_DAY
const EARLY_CHECKOUT    = 16 * 60 + 30;  // 4:30 PM  — before this = HALF_DAY
const FULLDAY_CHECKOUT  = 18 * 60;       // 6:00 PM  — at or after = FULL_DAY
const MIN_WORKING_HOURS = 4;             // below 4 h worked = HALF_DAY regardless

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

  // Step 5: Time-based status at check-in
  const now       = new Date();
  const totalMins = now.getHours() * 60 + now.getMinutes();

  let status        = 'FULL_DAY';
  let isRealHalfDay = false;
  let displayStatus = 'FULL_DAY';
  let checkInNote   = '';
  let message       = '';

  if (totalMins > HALFDAY_CHECKIN) {
    // After 1:00 PM → instant HALF_DAY, checkout cannot upgrade
    status        = 'HALF_DAY';
    isRealHalfDay = true;
    displayStatus = 'HALF_DAY';
    checkInNote   = 'late_halfday';
    message       = 'Checked in after 1:00 PM. Marked as Half Day — checkout time will not change this.';
  } else if (totalMins > GRACE_END) {
    // 10:11 AM – 1:00 PM → Late. Status stays FULL_DAY tentatively; final call at checkout
    checkInNote = 'late_arrival';
    message     = 'Checked in late. Full Day will be granted only if you check out at or after 6:00 PM.';
  } else if (totalMins > ON_TIME_CHECKIN) {
    // 10:01 – 10:10 AM → Grace period — on-time, minor note
    checkInNote = 'grace_period';
    message     = 'Checked in within the 10-minute grace window. Please be on time tomorrow.';
  } else {
    // Before 10:00 AM → on time
    message = 'Checked in on time. Have a productive day!';
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
      notes: checkInNote,
    },
    { new: true, upsert: true }
  );

  await createAuditLog({ actor: { _id: employeeId }, action: 'CHECK_IN_SUCCESS', entity: 'Attendance', entityId: attendance._id, description: `Check-in at ${checkInTime} (${checkInNote || 'on_time'})`, req });

  return { checkInTime, displayStatus, message };
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

  const updateFields = { checkOut: now, checkOutTime, workingHours };
  let outMessage = '';

  // Rule: must work at least 4 hours for any credit (half or full). Below 4 h = ABSENT.
  if (workingHours < MIN_WORKING_HOURS) {
    // Fewer than 4 hours worked → ABSENT (single-entry or too short)
    updateFields.status        = 'ABSENT';
    updateFields.displayStatus = 'ABSENT';
    updateFields.isRealHalfDay = false;
    outMessage = `Checked out. Marked as Absent — worked only ${workingHours} hours (minimum 4 required for Half Day).`;

  } else if (attendance.isRealHalfDay && attendance.notes === 'late_halfday') {
    // Came after 1:00 PM AND worked ≥ 4 h → Half Day (locked, checkout cannot upgrade)
    outMessage = `Checked out. You worked ${workingHours} hours. Marked as Half Day (check-in after 1:00 PM).`;

  } else if (checkoutMins < EARLY_CHECKOUT) {
    // Checkout before 4:30 PM and worked ≥ 4 h → Half Day (early leave)
    updateFields.status        = 'HALF_DAY';
    updateFields.displayStatus = 'HALF_DAY';
    updateFields.isRealHalfDay = true;
    outMessage = `Checked out early (before 4:30 PM). Marked as Half Day. You worked ${workingHours} hours.`;

  } else if (checkoutMins >= FULLDAY_CHECKOUT) {
    // Checkout at or after 6:00 PM → Full Day (even if check-in was late, up to 1 PM)
    updateFields.status        = 'FULL_DAY';
    updateFields.displayStatus = 'FULL_DAY';
    updateFields.isRealHalfDay = false;
    const wasLate = attendance.notes === 'late_arrival';
    outMessage = wasLate
      ? `Checked out. Full Day marked — you stayed until 6:00 PM despite late arrival. Worked ${workingHours} hours.`
      : `Checked out. Full Day marked. Great work! You worked ${workingHours} hours.`;

  } else {
    // Checkout between 4:30 PM – 6:00 PM → Half Day (did not complete full shift)
    updateFields.status        = 'HALF_DAY';
    updateFields.displayStatus = 'HALF_DAY';
    updateFields.isRealHalfDay = true;
    outMessage = `Checked out between 4:30–6:00 PM. Marked as Half Day. Stay until 6:00 PM for a Full Day. Worked ${workingHours} hours.`;
  }

  await Attendance.findByIdAndUpdate(attendance._id, updateFields);

  return { checkOutTime, workingHours, message: outMessage };
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
