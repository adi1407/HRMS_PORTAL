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
// Full Day   : worked 8+ hours total (regardless of arrival time — overrides everything)
// Half Day   : check-in after 1:00 PM AND worked < 8 h
// Half Day   : checkout before 4:00 PM AND worked < 8 h
// Absent     : no check-in AND no check-out
// Absent     : only check-in with no checkout (single entry = no credit)
// Absent     : only check-out with no check-in (should not happen normally)
// Grace      : 10:01–10:10 AM → treated as on-time, noted only

const ON_TIME_CHECKIN   = 10 * 60;       // 10:00 AM
const GRACE_END         = 10 * 60 + 10;  // 10:10 AM — 10-min grace window
const HALFDAY_CHECKIN   = 13 * 60;       // 1:00 PM  — after this = HALF_DAY (unless 8+ h worked)
const EARLY_CHECKOUT    = 16 * 60;       // 4:00 PM  — before this = HALF_DAY (unless 8+ h worked)
const FULLDAY_HOURS     = 8;             // 8+ hours worked = FULL_DAY regardless of times

const TZ = 'Asia/Kolkata';
function toIST(date) {
  return new Date(date.toLocaleString('en-US', { timeZone: TZ }));
}
function istToday() {
  const d = toIST(new Date());
  d.setHours(0, 0, 0, 0);
  return d;
}

const processCheckIn = async ({ employeeId, branchId, faceDescriptor, lat, lon, wifiSSID, req }) => {

  // Step 1: WiFi SSID verification (replaces IP-based check)
  const branch = await Branch.findById(branchId);
  if (!branch || !branch.isActive) throw new ApiError(404, 'Branch not found.');

  if (branch.wifiSSIDs && branch.wifiSSIDs.length > 0) {
    const isDev = process.env.NODE_ENV !== 'production';
    const ssid  = (wifiSSID || '').trim();
    const isAllowed = branch.wifiSSIDs.some(s => s.toLowerCase() === ssid.toLowerCase());
    console.log(`[WIFI CHECK] ssid="${ssid}" allowedSSIDs=${JSON.stringify(branch.wifiSSIDs)} isAllowed=${isAllowed} isDev=${isDev}`);
    if (!isDev && !isAllowed) {
      await createAuditLog({ actor: { _id: employeeId }, action: 'CHECK_IN_DENIED_NETWORK', severity: 'WARNING', description: `WiFi "${ssid}" not in allowed list for branch "${branch.name}"`, req });
      throw new ApiError(403, `Please connect to the office WiFi (${branch.wifiSSIDs.join(' or ')}) to check in.`);
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
  const todayStart = istToday();
  const existing = await Attendance.findOne({ employee: employeeId, date: todayStart });
  if (existing?.checkIn) throw new ApiError(409, 'Already checked in today.');

  // Step 5: Time-based status at check-in (IST)
  const now      = new Date();
  const nowIST   = toIST(now);
  const totalMins = nowIST.getHours() * 60 + nowIST.getMinutes();

  let status        = 'FULL_DAY';
  let isRealHalfDay = false;
  let displayStatus = 'FULL_DAY';
  let checkInNote   = '';
  let message       = '';

  if (totalMins > HALFDAY_CHECKIN) {
    // After 1:00 PM → tentatively HALF_DAY (can be upgraded to FULL_DAY at checkout if 8+ h worked)
    status        = 'HALF_DAY';
    isRealHalfDay = true;
    displayStatus = 'HALF_DAY';
    checkInNote   = 'late_halfday';
    message       = 'Checked in after 1:00 PM. Tentatively Half Day — will be upgraded to Full Day if you work 8+ hours total.';
  } else if (totalMins > GRACE_END) {
    // 10:11 AM – 1:00 PM → Late. Status stays FULL_DAY tentatively; final call at checkout
    checkInNote = 'late_arrival';
    message     = 'Checked in late. Full Day requires 8+ hours of total work.';
  } else if (totalMins > ON_TIME_CHECKIN) {
    // 10:01 – 10:10 AM → Grace period — on-time, minor note
    checkInNote = 'grace_period';
    message     = 'Checked in within the 10-minute grace window. Please be on time tomorrow.';
  } else {
    // Before 10:00 AM → on time
    message = 'Checked in on time. Have a productive day!';
  }

  // Step 6: Save
  const checkInTime = `${String(nowIST.getHours()).padStart(2,'0')}:${String(nowIST.getMinutes()).padStart(2,'0')}`;

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

const processCheckOut = async ({ employeeId, branchId, faceDescriptor, lat, lon, wifiSSID, req }) => {
  const branch = await Branch.findById(branchId);
  if (!branch || !branch.isActive) throw new ApiError(404, 'Branch not found.');

  // WiFi SSID verification
  if (branch.wifiSSIDs && branch.wifiSSIDs.length > 0) {
    const isDev = process.env.NODE_ENV !== 'production';
    const ssid  = (wifiSSID || '').trim();
    const isAllowed = branch.wifiSSIDs.some(s => s.toLowerCase() === ssid.toLowerCase());
    if (!isDev && !isAllowed) {
      throw new ApiError(403, `Please connect to the office WiFi (${branch.wifiSSIDs.join(' or ')}) to check out.`);
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

  const todayStart = istToday();

  const attendance = await Attendance.findOne({ employee: employeeId, date: todayStart });
  if (!attendance?.checkIn) throw new ApiError(400, 'No check-in found for today.');
  if (attendance.checkOut)  throw new ApiError(409, 'Already checked out today.');

  const now          = new Date();
  const nowIST       = toIST(now);
  const checkoutMins = nowIST.getHours() * 60 + nowIST.getMinutes();
  const workingHours = parseFloat(((now - attendance.checkIn) / (1000 * 60 * 60)).toFixed(2));
  const checkOutTime = `${String(nowIST.getHours()).padStart(2,'0')}:${String(nowIST.getMinutes()).padStart(2,'0')}`;

  const updateFields = { checkOut: now, checkOutTime, workingHours };
  let outMessage = '';

  // ── Priority 1: 8+ hours worked → FULL DAY regardless of arrival/departure time ──
  if (workingHours >= FULLDAY_HOURS) {
    updateFields.status        = 'FULL_DAY';
    updateFields.displayStatus = 'FULL_DAY';
    updateFields.isRealHalfDay = false;
    const wasLateHalf = attendance.notes === 'late_halfday';
    outMessage = wasLateHalf
      ? `Checked out. Full Day marked — you worked ${workingHours} hours despite arriving after 1:00 PM. Great effort!`
      : `Checked out. Full Day marked. You worked ${workingHours} hours. Great work!`;

  // ── Priority 2: Check-in after 1 PM AND worked < 8 h → HALF DAY ──
  } else if (attendance.isRealHalfDay && attendance.notes === 'late_halfday') {
    outMessage = `Checked out. Half Day — arrived after 1:00 PM and worked ${workingHours} hours (need 8+ hours for Full Day).`;

  // ── Priority 3: Checkout before 4:00 PM AND worked < 8 h → HALF DAY ──
  } else if (checkoutMins < EARLY_CHECKOUT) {
    updateFields.status        = 'HALF_DAY';
    updateFields.displayStatus = 'HALF_DAY';
    updateFields.isRealHalfDay = true;
    outMessage = `Checked out before 4:00 PM. Half Day — worked ${workingHours} hours (need 8+ hours for Full Day).`;

  // ── Priority 4: Checkout at/after 4:00 PM but worked < 8 h → HALF DAY ──
  } else {
    updateFields.status        = 'HALF_DAY';
    updateFields.displayStatus = 'HALF_DAY';
    updateFields.isRealHalfDay = true;
    outMessage = `Checked out after 4:00 PM but worked only ${workingHours} hours. Half Day — need 8+ hours for Full Day.`;
  }

  await Attendance.findByIdAndUpdate(attendance._id, updateFields);

  return { checkOutTime, workingHours, message: outMessage };
};

const getTodayAttendance = async (employeeId) => {
  const todayStart = istToday();
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
