const AttendanceSettings = require('../models/AttendanceSettings.model');
const { ApiError } = require('../utils/api.utils');

const LIMITS = {
  onTimeCheckInMinutes: [0, 23 * 60 + 59],
  gracePeriodMinutes: [0, 180],
  halfDayCheckInAfterMinutes: [0, 23 * 60 + 59],
  earlyCheckoutBeforeMinutes: [0, 23 * 60 + 59],
  fullDayHours: [0.5, 16],
};

function assertRange(name, value, [lo, hi]) {
  if (typeof value !== 'number' || Number.isNaN(value)) throw new ApiError(400, `${name} must be a number.`);
  if (value < lo || value > hi) throw new ApiError(400, `${name} must be between ${lo} and ${hi}.`);
}

/**
 * Validates cross-field rules. Times are minutes from midnight (IST) for check-in/out clocks.
 */
function validateTimingFields(body) {
  const onTime = body.onTimeCheckInMinutes;
  const grace = body.gracePeriodMinutes;
  const halfAfter = body.halfDayCheckInAfterMinutes;
  const earlyOut = body.earlyCheckoutBeforeMinutes;
  const fullH = body.fullDayHours;

  if (onTime !== undefined) assertRange('onTimeCheckInMinutes', onTime, LIMITS.onTimeCheckInMinutes);
  if (grace !== undefined) assertRange('gracePeriodMinutes', grace, LIMITS.gracePeriodMinutes);
  if (halfAfter !== undefined) assertRange('halfDayCheckInAfterMinutes', halfAfter, LIMITS.halfDayCheckInAfterMinutes);
  if (earlyOut !== undefined) assertRange('earlyCheckoutBeforeMinutes', earlyOut, LIMITS.earlyCheckoutBeforeMinutes);
  if (fullH !== undefined) assertRange('fullDayHours', fullH, LIMITS.fullDayHours);

  const o = onTime !== undefined ? onTime : undefined;
  const g = grace !== undefined ? grace : undefined;
  const h = halfAfter !== undefined ? halfAfter : undefined;
  const e = earlyOut !== undefined ? earlyOut : undefined;

  if (o !== undefined && g !== undefined && h !== undefined) {
    const graceEnd = o + g;
    if (graceEnd >= h) {
      throw new ApiError(400, 'On-time time + grace period must end before the half-day check-in threshold.');
    }
  }
  if (o !== undefined && g !== undefined && e !== undefined) {
    const graceEnd = o + g;
    if (e <= graceEnd) {
      throw new ApiError(400, 'Early checkout threshold must be after the end of the grace window.');
    }
  }
}

/** Public shape for API (admin UI). */
async function getAttendanceSettingsDTO() {
  const doc = await AttendanceSettings.getSingleton();
  const graceEndMinutes = doc.onTimeCheckInMinutes + doc.gracePeriodMinutes;
  return {
    onTimeCheckInMinutes: doc.onTimeCheckInMinutes,
    gracePeriodMinutes: doc.gracePeriodMinutes,
    graceEndMinutes,
    halfDayCheckInAfterMinutes: doc.halfDayCheckInAfterMinutes,
    earlyCheckoutBeforeMinutes: doc.earlyCheckoutBeforeMinutes,
    fullDayHours: doc.fullDayHours,
    updatedAt: doc.updatedAt,
  };
}

/** Resolved constants for attendance engine (IST). */
async function getResolvedRules() {
  const doc = await AttendanceSettings.getSingleton();
  return {
    ON_TIME_CHECKIN: doc.onTimeCheckInMinutes,
    GRACE_END: doc.onTimeCheckInMinutes + doc.gracePeriodMinutes,
    HALFDAY_CHECKIN: doc.halfDayCheckInAfterMinutes,
    EARLY_CHECKOUT: doc.earlyCheckoutBeforeMinutes,
    FULLDAY_HOURS: doc.fullDayHours,
  };
}

const PATCH_KEYS = ['onTimeCheckInMinutes', 'gracePeriodMinutes', 'halfDayCheckInAfterMinutes', 'earlyCheckoutBeforeMinutes', 'fullDayHours'];

async function updateAttendanceSettings(patch) {
  if (!patch || typeof patch !== 'object') throw new ApiError(400, 'Invalid body.');
  if (!PATCH_KEYS.some((k) => patch[k] !== undefined)) throw new ApiError(400, 'No timing fields to update.');
  validateTimingFields({ ...patch });
  const doc = await AttendanceSettings.getSingleton();

  const next = {
    onTimeCheckInMinutes: patch.onTimeCheckInMinutes ?? doc.onTimeCheckInMinutes,
    gracePeriodMinutes: patch.gracePeriodMinutes ?? doc.gracePeriodMinutes,
    halfDayCheckInAfterMinutes: patch.halfDayCheckInAfterMinutes ?? doc.halfDayCheckInAfterMinutes,
    earlyCheckoutBeforeMinutes: patch.earlyCheckoutBeforeMinutes ?? doc.earlyCheckoutBeforeMinutes,
    fullDayHours: patch.fullDayHours ?? doc.fullDayHours,
  };

  validateTimingFields({
    onTimeCheckInMinutes: next.onTimeCheckInMinutes,
    gracePeriodMinutes: next.gracePeriodMinutes,
    halfDayCheckInAfterMinutes: next.halfDayCheckInAfterMinutes,
    earlyCheckoutBeforeMinutes: next.earlyCheckoutBeforeMinutes,
    fullDayHours: next.fullDayHours,
  });

  doc.set(next);
  await doc.save();

  return { dto: await getAttendanceSettingsDTO() };
}

module.exports = {
  getAttendanceSettingsDTO,
  getResolvedRules,
  updateAttendanceSettings,
};
