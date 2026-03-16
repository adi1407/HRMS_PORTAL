const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const Branch = require('../models/Branch.model');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const branches = await Branch.find({ isActive: true });
    res.json({ success: true, data: branches });
  } catch (err) { next(err); }
});
router.post('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const branch = await Branch.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, data: branch });
  } catch (err) { next(err); }
});
router.patch('/:id', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const branch = await Branch.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: branch });
  } catch (err) { next(err); }
});

// Returns the caller's IP and subnet prefix so admin can register the whole office network
router.get('/myip', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), (req, res) => {
  const raw       = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '';
  const ip        = raw.replace(/^::ffff:/, '') || '127.0.0.1';
  const isLoopback = ['127.0.0.1', '::1', 'localhost', ''].includes(ip);
  // Derive /24 subnet prefix: "192.168.0.113" → "192.168.0."
  const parts  = ip.split('.');
  const subnet = (!isLoopback && parts.length === 4) ? parts.slice(0, 3).join('.') + '.' : null;
  res.json({ success: true, ip, subnet, isLoopback });
});

// Add an IP to a branch's allowed list
router.post('/:id/allowip', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ success: false, message: 'ip is required.' });
    const branch = await Branch.findByIdAndUpdate(req.params.id, { $addToSet: { allowedIPs: ip } }, { new: true });
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found.' });
    res.json({ success: true, data: branch });
  } catch (err) { next(err); }
});

// Remove an IP from a branch's allowed list
router.delete('/:id/allowip', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { ip } = req.body;
    const branch = await Branch.findByIdAndUpdate(req.params.id, { $pull: { allowedIPs: ip } }, { new: true });
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found.' });
    res.json({ success: true, data: branch });
  } catch (err) { next(err); }
});

// Add a WiFi SSID to a branch
router.post('/:id/wifi-ssid', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { ssid } = req.body;
    if (!ssid || !ssid.trim()) return res.status(400).json({ success: false, message: 'SSID is required.' });
    const branch = await Branch.findByIdAndUpdate(req.params.id, { $addToSet: { wifiSSIDs: ssid.trim() } }, { new: true });
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found.' });
    res.json({ success: true, data: branch });
  } catch (err) { next(err); }
});

// Remove a WiFi SSID from a branch
router.delete('/:id/wifi-ssid', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { ssid } = req.body;
    const branch = await Branch.findByIdAndUpdate(req.params.id, { $pull: { wifiSSIDs: ssid } }, { new: true });
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found.' });
    res.json({ success: true, data: branch });
  } catch (err) { next(err); }
});

module.exports = router;
