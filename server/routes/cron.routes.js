const express = require('express');
const router = express.Router();
const {
  runAutoAbsent,
  runHolidayMark,
  runEodEvaluation,
  runSalaryGen,
  runAutoRemoveResigned,
  runEmailAlerts,
} = require('../cron');

const JOBS = {
  'auto-absent': runAutoAbsent,
  'holiday': runHolidayMark,
  'eod': runEodEvaluation,
  'salary-gen': runSalaryGen,
  'auto-remove-resigned': runAutoRemoveResigned,
  'email-alerts': runEmailAlerts,
};

// For Render / external cron: call with CRON_SECRET so cron runs even when the app was sleeping.
// Example: POST /api/cron/trigger { "secret": "your-CRON_SECRET", "job": "auto-absent" }
// Or GET /api/cron/trigger?secret=xxx&job=auto-absent (for cron-job.org)
router.all('/trigger', async (req, res) => {
  const secret = req.body?.secret || req.query?.secret;
  const job = (req.body?.job || req.query?.job || '').toLowerCase();

  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return res.status(401).json({ success: false, message: 'Invalid or missing cron secret' });
  }

  const fn = JOBS[job];
  if (!fn) {
    return res.status(400).json({
      success: false,
      message: 'Unknown job. Use one of: ' + Object.keys(JOBS).join(', '),
    });
  }

  try {
    const result = await fn();
    res.json({ success: true, job, result });
  } catch (err) {
    console.error('[CRON trigger]', job, err);
    res.status(500).json({ success: false, job, error: err.message });
  }
});

module.exports = router;
