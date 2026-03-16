const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const Holiday    = require('../models/Holiday.model');
const User       = require('../models/User.model');
const Attendance = require('../models/Attendance.model');

// All authenticated users can view holidays
router.get('/', authenticate, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.year) filter.date = { $gte: new Date(req.query.year, 0, 1), $lte: new Date(req.query.year, 11, 31) };
    const holidays = await Holiday.find(filter).sort({ date: 1 });
    res.json({ success: true, data: holidays });
  } catch (err) { next(err); }
});

// Only SUPER_ADMIN and DIRECTOR can announce holidays
router.post('/', authenticate, authorize('SUPER_ADMIN', 'DIRECTOR'), async (req, res, next) => {
  try {
    const holiday = await Holiday.create({ ...req.body, createdBy: req.user._id });

    // If the holiday is for TODAY, the midnight cron won't run again — apply immediately
    const holidayDate = new Date(holiday.date); holidayDate.setHours(0, 0, 0, 0);
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })); today.setHours(0, 0, 0, 0);
    if (holidayDate.getTime() === today.getTime()) {
      const staff = await User.find({ isActive: true, role: { $in: ['EMPLOYEE', 'HR', 'ACCOUNTS', 'DIRECTOR'] } });
      for (const emp of staff) {
        await Attendance.findOneAndUpdate(
          { employee: emp._id, date: today },
          { status: 'HOLIDAY', displayStatus: 'FULL_DAY', notes: `Holiday: ${holiday.name}`, markedBy: 'CRON' },
          { upsert: true, new: true }
        );
      }
    }
    res.status(201).json({ success: true, data: holiday });
  } catch (err) { next(err); }
});

// Only SUPER_ADMIN and DIRECTOR can remove holidays
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'DIRECTOR'), async (req, res, next) => {
  try {
    await Holiday.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Holiday removed.' });
  } catch (err) { next(err); }
});

module.exports = router;
