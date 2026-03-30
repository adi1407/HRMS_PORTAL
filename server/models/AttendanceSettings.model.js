const mongoose = require('mongoose');
const { Schema } = mongoose;

/** Singleton org-wide attendance timing (IST, minutes from midnight where applicable). */
const AttendanceSettingsSchema = new Schema(
  {
    onTimeCheckInMinutes: { type: Number, default: 10 * 60 },
    gracePeriodMinutes: { type: Number, default: 10 },
    halfDayCheckInAfterMinutes: { type: Number, default: 13 * 60 },
    earlyCheckoutBeforeMinutes: { type: Number, default: 16 * 60 },
    fullDayHours: { type: Number, default: 8 },
  },
  { timestamps: true }
);

AttendanceSettingsSchema.statics.getSingleton = async function getSingleton() {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  return doc;
};

module.exports = mongoose.model('AttendanceSettings', AttendanceSettingsSchema);
