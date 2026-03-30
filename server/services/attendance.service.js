// ⚠️  SECURITY: Real deduction threshold is hardcoded here ONLY.
// NEVER store in .env, frontend, or API responses.

const Attendance = require('../models/Attendance.model');
const Branch     = require('../models/Branch.model');
const Salary     = require('../models/Salary.model');
const User       = require('../models/User.model');
const { isWithinGeoFence }    = require('../utils/geo.utils');
const { createAuditLog }      = require('../utils/auditLog.utils');
const { ApiError }            = require('../utils/api.utils');
const { generateMonthlySalary } = require('./salary.service');
const { verifyAuthenticationForAttendance } = require('./webauthn.service');
const { getResolvedRules } = require('./attendanceSettings.service');

// ─── Attendance Time Rules ───────────────────────────────────────────────────
// Defaults & semantics live in AttendanceSettings (singleton) — editable by Super Admin / Director.
// Full Day   : worked fullDayHours+ total (regardless of arrival time — overrides everything)
// Half Day   : check-in after half-day threshold AND worked < fullDayHours
// Half Day   : checkout before early-checkout threshold AND worked < fullDayHours
// Absent     : no check-in AND no check-out
// Absent     : only check-in with no checkout (single entry = no credit)
// Absent     : only check-out with no check-in (should not happen normally)
// Grace      : after on-time through grace end → treated as on-time, noted only

const TZ = 'Asia/Kolkata';
function toIST(date) {
  return new Date(date.toLocaleString('en-US', { timeZone: TZ }));
}
function istToday() {
  const d = toIST(new Date());
  d.setHours(0, 0, 0, 0);
  return d;
}

function getClientIP(req) {
  const raw = req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.ip || req?.connection?.remoteAddress || '';
  return raw.replace(/^::ffff:/, '') || '';
}

function ipMatchesAllowed(clientIP, allowedIPs) {
  if (!clientIP || !allowedIPs?.length) return false;
  return allowedIPs.some(allowed => {
    if (allowed.endsWith('.')) {
      return clientIP.startsWith(allowed);
    }
    return clientIP === allowed;
  });
}

function isMobileClient(req) {
  return (req?.headers?.['x-client'] || '').toLowerCase() === 'mobile';
}

/**
 * When HR enables biometric attendance: mobile must complete in-app enrollment;
 * web must send a verified WebAuthn assertion (passkey / fingerprint / device PIN).
 */
async function ensureBiometricForAttendance(employeeId, req) {
  const fromMobile = isMobileClient(req);
  const emp = await User.findById(employeeId).select('+webAuthnCredentials');
  if (!emp) throw new ApiError(404, 'Employee not found.');
  if (!emp.biometricAttendanceEnabled) return;
  if (fromMobile) {
    if (!emp.biometricMobileEnrolledAt) {
      throw new ApiError(400, 'Complete biometric enrollment in the mobile app after HR has enabled it.');
    }
    return;
  }
  const webAuthn = req.body?.webAuthn;
  if (!(emp.webAuthnCredentials || []).length) {
    throw new ApiError(400, 'Register a browser passkey on the Check In page first.');
  }
  if (!webAuthn) {
    throw new ApiError(400, 'Biometric confirmation required on web. Confirm with passkey / fingerprint when prompted.');
  }
  try {
    await verifyAuthenticationForAttendance(emp, webAuthn);
  } catch (e) {
    throw new ApiError(401, e.message || 'Biometric verification failed.');
  }
}

const processCheckIn = async ({ employeeId, branchId, lat, lon, wifiSSID, req }) => {

  const branch = await Branch.findById(branchId);
  if (!branch || !branch.isActive) throw new ApiError(404, 'Branch not found.');

  // Step 1a: IP verification — skip for mobile app; mobile uses GPS + optional WiFi selection instead
  const fromMobile = isMobileClient(req);
  if (!fromMobile && branch.allowedIPs && branch.allowedIPs.length > 0) {
    const clientIP = getClientIP(req);
    const isDev = process.env.NODE_ENV !== 'production';
    const ipOk = ipMatchesAllowed(clientIP, branch.allowedIPs);
    console.log(`[IP CHECK] clientIP="${clientIP}" allowedIPs=${JSON.stringify(branch.allowedIPs)} ipOk=${ipOk} isDev=${isDev}`);
    if (!isDev && !ipOk) {
      await createAuditLog({ actor: { _id: employeeId }, action: 'CHECK_IN_DENIED_NETWORK', severity: 'WARNING', description: `IP ${clientIP} not in allowed list for branch "${branch.name}"`, req });
      throw new ApiError(403, 'Check-in only allowed from the office network. Connect to office WiFi and try again.');
    }
  }

  // Step 1b: WiFi SSID — mobile app sends user-selected SSID from branch list; skip in dev
  if (branch.wifiSSIDs && branch.wifiSSIDs.length > 0) {
    const isDev = process.env.NODE_ENV !== 'production';
    const ssid  = (wifiSSID || '').trim();
    const isAllowed = branch.wifiSSIDs.some(s => s.toLowerCase() === ssid.toLowerCase());
    console.log(`[WIFI CHECK] ssid="${ssid}" allowedSSIDs=${JSON.stringify(branch.wifiSSIDs)} isAllowed=${isAllowed} isDev=${isDev} fromMobile=${fromMobile}`);
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

  await ensureBiometricForAttendance(employeeId, req);

  // Step 3: Duplicate check
  const todayStart = istToday();
  const existing = await Attendance.findOne({ employee: employeeId, date: todayStart });
  if (existing?.checkIn) throw new ApiError(409, 'Already checked in today.');

  // Step 4: Time-based status at check-in (IST)
  const { ON_TIME_CHECKIN, GRACE_END, HALFDAY_CHECKIN, FULLDAY_HOURS } = await getResolvedRules();
  const now      = new Date();
  const nowIST   = toIST(now);
  const totalMins = nowIST.getHours() * 60 + nowIST.getMinutes();

  let status        = 'FULL_DAY';
  let isRealHalfDay = false;
  let displayStatus = 'FULL_DAY';
  let checkInNote   = '';
  let message       = '';

  if (totalMins > HALFDAY_CHECKIN) {
    status        = 'HALF_DAY';
    isRealHalfDay = true;
    displayStatus = 'HALF_DAY';
    checkInNote   = 'late_halfday';
    message       = `Checked in after the configured late threshold. Tentatively Half Day — will be upgraded to Full Day if you work ${FULLDAY_HOURS}+ hours total.`;
  } else if (totalMins > GRACE_END) {
    checkInNote = 'late_arrival';
    message     = `Checked in late. Full Day requires ${FULLDAY_HOURS}+ hours of total work.`;
  } else if (totalMins > ON_TIME_CHECKIN) {
    checkInNote = 'grace_period';
    message     = 'Checked in within the grace window. Please be on time tomorrow.';
  } else {
    message = 'Checked in on time. Have a productive day!';
  }

  // Step 5: Save
  const checkInTime = `${String(nowIST.getHours()).padStart(2,'0')}:${String(nowIST.getMinutes()).padStart(2,'0')}`;

  const attendance = await Attendance.findOneAndUpdate(
    { employee: employeeId, date: todayStart },
    {
      checkIn: now, checkInTime,
      status, displayStatus, isRealHalfDay,
      faceConfidence: 0,
      markedBy: 'SYSTEM',
      notes: checkInNote,
    },
    { new: true, upsert: true }
  );

  await createAuditLog({ actor: { _id: employeeId }, action: 'CHECK_IN_SUCCESS', entity: 'Attendance', entityId: attendance._id, description: `Check-in at ${checkInTime} (${checkInNote || 'on_time'})`, req });

  return { checkInTime, displayStatus, message };
};

const processCheckOut = async ({ employeeId, branchId, lat, lon, wifiSSID, req }) => {
  const branch = await Branch.findById(branchId);
  if (!branch || !branch.isActive) throw new ApiError(404, 'Branch not found.');

  const fromMobile = isMobileClient(req);
  if (!fromMobile && branch.allowedIPs && branch.allowedIPs.length > 0) {
    const clientIP = getClientIP(req);
    const isDev = process.env.NODE_ENV !== 'production';
    if (!isDev && !ipMatchesAllowed(clientIP, branch.allowedIPs)) {
      throw new ApiError(403, 'Check-out only allowed from the office network. Connect to office WiFi and try again.');
    }
  }

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

  await ensureBiometricForAttendance(employeeId, req);

  const todayStart = istToday();

  const attendance = await Attendance.findOne({ employee: employeeId, date: todayStart });
  if (!attendance?.checkIn) throw new ApiError(400, 'No check-in found for today.');
  if (attendance.checkOut)  throw new ApiError(409, 'Already checked out today.');

  const now          = new Date();
  const nowIST       = toIST(now);
  const checkoutMins = nowIST.getHours() * 60 + nowIST.getMinutes();
  const workingHours = parseFloat(((now - attendance.checkIn) / (1000 * 60 * 60)).toFixed(2));
  const checkOutTime = `${String(nowIST.getHours()).padStart(2,'0')}:${String(nowIST.getMinutes()).padStart(2,'0')}`;

  const { EARLY_CHECKOUT, FULLDAY_HOURS } = await getResolvedRules();

  const updateFields = { checkOut: now, checkOutTime, workingHours };
  let outMessage = '';

  // ── Priority 1: fullDayHours+ worked → FULL DAY regardless of arrival/departure time ──
  if (workingHours >= FULLDAY_HOURS) {
    updateFields.status        = 'FULL_DAY';
    updateFields.displayStatus = 'FULL_DAY';
    updateFields.isRealHalfDay = false;
    const wasLateHalf = attendance.notes === 'late_halfday';
    outMessage = wasLateHalf
      ? `Checked out. Full Day marked — you worked ${workingHours} hours despite a late check-in. Great effort!`
      : `Checked out. Full Day marked. You worked ${workingHours} hours. Great work!`;

  // ── Priority 2: Late check-in half-day AND worked < fullDayHours
  } else if (attendance.isRealHalfDay && attendance.notes === 'late_halfday') {
    outMessage = `Checked out. Half Day — late check-in and worked ${workingHours} hours (need ${FULLDAY_HOURS}+ hours for Full Day).`;

  // ── Priority 3: Checkout before early threshold AND worked < fullDayHours
  } else if (checkoutMins < EARLY_CHECKOUT) {
    updateFields.status        = 'HALF_DAY';
    updateFields.displayStatus = 'HALF_DAY';
    updateFields.isRealHalfDay = true;
    outMessage = `Checked out before the configured early-checkout time. Half Day — worked ${workingHours} hours (need ${FULLDAY_HOURS}+ hours for Full Day).`;

  // ── Priority 4: At/after early checkout time but worked < fullDayHours
  } else {
    updateFields.status        = 'HALF_DAY';
    updateFields.displayStatus = 'HALF_DAY';
    updateFields.isRealHalfDay = true;
    outMessage = `Checked out after the early-checkout time but worked only ${workingHours} hours. Half Day — need ${FULLDAY_HOURS}+ hours for Full Day.`;
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
