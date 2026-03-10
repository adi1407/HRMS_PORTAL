const express = require('express');
const router  = express.Router();
const Asset   = require('../models/Asset.model');
const User    = require('../models/User.model');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { ApiError } = require('../utils/api.utils');

// ── POST / — HR/Admin: create asset ─────────────────────────
router.post('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { name, type, brand, modelName, serialNumber, purchaseDate, purchaseCost, condition, notes } = req.body;
    if (!name?.trim()) return next(new ApiError(400, 'Asset name is required.'));
    if (!type) return next(new ApiError(400, 'Asset type is required.'));

    const asset = await Asset.create({
      name: name.trim(),
      type,
      brand: brand?.trim(),
      modelName: modelName?.trim(),
      serialNumber: serialNumber?.trim(),
      purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
      purchaseCost: purchaseCost ? Number(purchaseCost) : undefined,
      condition: ['NEW', 'GOOD', 'FAIR', 'POOR'].includes(condition) ? condition : 'NEW',
      notes: notes?.trim(),
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, message: `Asset ${asset.assetId} created.`, data: asset });
  } catch (err) { next(err); }
});

// ── GET / — HR/Admin: all assets with filters ────────────────
router.get('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { status, type, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (search) {
      filter.$or = [
        { name: new RegExp(search.trim(), 'i') },
        { assetId: new RegExp(search.trim(), 'i') },
        { serialNumber: new RegExp(search.trim(), 'i') },
      ];
    }

    const assets = await Asset.find(filter)
      .populate('currentAssignment.employee', 'name employeeId designation')
      .populate('currentAssignment.assignedBy', 'name')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: assets });
  } catch (err) { next(err); }
});

// ── GET /my — Employee: assets assigned to me ────────────────
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const assets = await Asset.find({
      status: 'ASSIGNED',
      'currentAssignment.employee': req.user._id,
    })
      .populate('currentAssignment.assignedBy', 'name')
      .sort({ 'currentAssignment.assignedDate': -1 });

    res.json({ success: true, data: assets });
  } catch (err) { next(err); }
});

// ── GET /stats — HR/Admin: asset statistics ──────────────────
router.get('/stats', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const [available, assigned, underRepair, retired, lost, total] = await Promise.all([
      Asset.countDocuments({ status: 'AVAILABLE' }),
      Asset.countDocuments({ status: 'ASSIGNED' }),
      Asset.countDocuments({ status: 'UNDER_REPAIR' }),
      Asset.countDocuments({ status: 'RETIRED' }),
      Asset.countDocuments({ status: 'LOST' }),
      Asset.countDocuments(),
    ]);
    res.json({ success: true, data: { available, assigned, underRepair, retired, lost, total } });
  } catch (err) { next(err); }
});

// ── PATCH /:id — HR/Admin: update asset details ─────────────
router.patch('/:id', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return next(new ApiError(404, 'Asset not found.'));

    const { name, type, brand, modelName, serialNumber, condition, status, notes } = req.body;
    if (name !== undefined) asset.name = name.trim();
    if (type !== undefined) asset.type = type;
    if (brand !== undefined) asset.brand = brand?.trim();
    if (modelName !== undefined) asset.modelName = modelName?.trim();
    if (serialNumber !== undefined) asset.serialNumber = serialNumber?.trim();
    if (condition !== undefined) asset.condition = condition;
    if (status !== undefined && ['AVAILABLE', 'UNDER_REPAIR', 'RETIRED', 'LOST'].includes(status)) {
      if (asset.status === 'ASSIGNED' && status !== 'ASSIGNED') {
        return next(new ApiError(409, 'Return the asset before changing status.'));
      }
      asset.status = status;
    }
    if (notes !== undefined) asset.notes = notes?.trim();

    await asset.save();
    res.json({ success: true, message: 'Asset updated.', data: asset });
  } catch (err) { next(err); }
});

// ── POST /:id/assign — HR/Admin: assign asset to employee ───
router.post('/:id/assign', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) return next(new ApiError(400, 'Employee ID is required.'));

    const asset = await Asset.findById(req.params.id);
    if (!asset) return next(new ApiError(404, 'Asset not found.'));
    if (asset.status === 'ASSIGNED') return next(new ApiError(409, 'Asset is already assigned. Return it first.'));
    if (!['AVAILABLE', 'UNDER_REPAIR'].includes(asset.status)) {
      return next(new ApiError(409, `Cannot assign asset with status ${asset.status}.`));
    }

    const employee = await User.findOne({ employeeId }).select('_id name');
    if (!employee) return next(new ApiError(404, 'Employee not found.'));

    asset.currentAssignment = {
      employee: employee._id,
      assignedDate: new Date(),
      assignedBy: req.user._id,
    };
    asset.status = 'ASSIGNED';
    await asset.save();

    res.json({ success: true, message: `Asset assigned to ${employee.name}.`, data: asset });
  } catch (err) { next(err); }
});

// ── POST /:id/return — HR/Admin: process asset return ────────
router.post('/:id/return', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { returnCondition, returnNote } = req.body;
    if (!returnCondition) return next(new ApiError(400, 'Return condition is required.'));

    const asset = await Asset.findById(req.params.id);
    if (!asset) return next(new ApiError(404, 'Asset not found.'));
    if (asset.status !== 'ASSIGNED') return next(new ApiError(409, 'Asset is not currently assigned.'));

    const assignment = { ...asset.currentAssignment.toObject() };
    assignment.returnDate = new Date();
    assignment.returnCondition = returnCondition;
    assignment.returnNote = returnNote?.trim() || '';
    assignment.returnProcessedBy = req.user._id;

    asset.assignmentHistory.push(assignment);
    asset.currentAssignment = undefined;
    asset.status = returnCondition === 'LOST' ? 'LOST' : returnCondition === 'DAMAGED' ? 'UNDER_REPAIR' : 'AVAILABLE';
    if (returnCondition === 'DAMAGED') asset.condition = 'POOR';

    await asset.save();
    res.json({ success: true, message: 'Asset returned successfully.', data: asset });
  } catch (err) { next(err); }
});

// ── GET /:id/history — HR/Admin: asset assignment history ────
router.get('/:id/history', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const asset = await Asset.findById(req.params.id)
      .populate('currentAssignment.employee', 'name employeeId')
      .populate('currentAssignment.assignedBy', 'name')
      .populate('assignmentHistory.employee', 'name employeeId')
      .populate('assignmentHistory.assignedBy', 'name')
      .populate('assignmentHistory.returnProcessedBy', 'name');

    if (!asset) return next(new ApiError(404, 'Asset not found.'));
    res.json({ success: true, data: asset });
  } catch (err) { next(err); }
});

// ── GET /employee/:empId — HR/Admin: assets for an employee ──
router.get('/employee/:empId', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const employee = await User.findOne({ employeeId: req.params.empId }).select('_id');
    if (!employee) return next(new ApiError(404, 'Employee not found.'));

    const assets = await Asset.find({
      $or: [
        { 'currentAssignment.employee': employee._id },
        { 'assignmentHistory.employee': employee._id },
      ],
    })
      .populate('currentAssignment.employee', 'name employeeId')
      .populate('currentAssignment.assignedBy', 'name');

    res.json({ success: true, data: assets });
  } catch (err) { next(err); }
});

// ── DELETE /:id — HR/Admin: delete asset ─────────────────────
router.delete('/:id', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return next(new ApiError(404, 'Asset not found.'));
    if (asset.status === 'ASSIGNED') return next(new ApiError(409, 'Cannot delete assigned asset. Return it first.'));
    await asset.deleteOne();
    res.json({ success: true, message: 'Asset deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
