const express         = require('express');
const router          = express.Router();
const multer          = require('multer');
const EmployeeProfile = require('../models/EmployeeProfile.model');
const User            = require('../models/User.model');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { ApiError }    = require('../utils/api.utils');
const { uploadBuffer, deleteFile } = require('../utils/cloudinary.utils');

const ALLOWED_MIME = [
  'application/pdf', 'image/jpeg', 'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, JPG, PNG, DOC, DOCX allowed.'));
  },
});

function rType(mime) { return mime.startsWith('image/') ? 'image' : 'raw'; }

// ── GET /my — employee gets own profile ─────────────────────
router.get('/my', authenticate, async (req, res, next) => {
  try {
    let profile = await EmployeeProfile.findOne({ employee: req.user._id });
    if (!profile) {
      profile = await EmployeeProfile.create({ employee: req.user._id });
    }
    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
});

// ── GET /:empId — HR views any employee profile ─────────────
router.get('/:empId', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    let profile = await EmployeeProfile.findOne({ employee: req.params.empId })
      .populate('employee', 'name employeeId email phone designation department joiningDate')
      .populate('lastUpdatedBy', 'name');
    if (!profile) {
      profile = await EmployeeProfile.create({ employee: req.params.empId });
      profile = await EmployeeProfile.findById(profile._id)
        .populate('employee', 'name employeeId email phone designation department joiningDate');
    }
    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
});

// ── GET / — HR: all profiles with completion stats ──────────
router.get('/', authenticate, authorize('HR', 'DIRECTOR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const employees = await User.find({ isActive: true, role: { $nin: ['SUPER_ADMIN'] } })
      .select('name employeeId designation department')
      .populate('department', 'name')
      .sort({ name: 1 });

    const profiles = await EmployeeProfile.find({
      employee: { $in: employees.map(e => e._id) },
    }).select('employee completionPercent profileCompleted');

    const profileMap = {};
    for (const p of profiles) profileMap[p.employee.toString()] = p;

    let result = employees.map(e => ({
      _id: e._id,
      name: e.name,
      employeeId: e.employeeId,
      designation: e.designation,
      department: e.department?.name || '—',
      completionPercent: profileMap[e._id.toString()]?.completionPercent || 0,
      profileCompleted: profileMap[e._id.toString()]?.profileCompleted || false,
    }));

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r => r.name.toLowerCase().includes(q) || r.employeeId.toLowerCase().includes(q));
    }
    if (status === 'complete') result = result.filter(r => r.completionPercent >= 80);
    if (status === 'incomplete') result = result.filter(r => r.completionPercent < 80);

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ── PATCH /my — employee updates own profile ────────────────
router.patch('/my', authenticate, async (req, res, next) => {
  try {
    const allowed = [
      'fatherName', 'motherName', 'dateOfBirth', 'gender', 'bloodGroup',
      'maritalStatus', 'spouseName', 'nationality', 'religion',
      'personalEmail', 'personalPhone',
      'emergencyContactName', 'emergencyContactRelation', 'emergencyContactPhone',
      'currentAddress', 'permanentAddress',
      'aadhaarNumber', 'panNumber', 'passportNumber', 'passportExpiry', 'uanNumber', 'esicNumber',
      'bankName', 'bankAccountNumber', 'ifscCode', 'bankBranch',
      'isFresher', 'totalExperienceYears',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.lastUpdatedBy = req.user._id;

    let profile = await EmployeeProfile.findOneAndUpdate(
      { employee: req.user._id },
      { $set: updates },
      { new: true, upsert: true }
    );
    res.json({ success: true, message: 'Profile updated.', data: profile });
  } catch (err) { next(err); }
});

// ── POST /my/education — add education entry ────────────────
router.post('/my/education', authenticate, async (req, res, next) => {
  try {
    const { level, boardOrUniversity, schoolOrCollege, degree, specialization, stream, yearOfPassing, percentage, cgpa } = req.body;
    if (!level) return next(new ApiError(400, 'Education level is required.'));
    let profile = await EmployeeProfile.findOne({ employee: req.user._id });
    if (!profile) profile = await EmployeeProfile.create({ employee: req.user._id });

    profile.education.push({ level, boardOrUniversity, schoolOrCollege, degree, specialization, stream, yearOfPassing, percentage, cgpa });
    profile.lastUpdatedBy = req.user._id;
    await profile.save();
    res.status(201).json({ success: true, message: 'Education added.', data: profile });
  } catch (err) { next(err); }
});

// ── PATCH /my/education/:eduId — update education entry ─────
router.patch('/my/education/:eduId', authenticate, async (req, res, next) => {
  try {
    const profile = await EmployeeProfile.findOne({ employee: req.user._id });
    if (!profile) return next(new ApiError(404, 'Profile not found.'));
    const edu = profile.education.id(req.params.eduId);
    if (!edu) return next(new ApiError(404, 'Education entry not found.'));
    const fields = ['level', 'boardOrUniversity', 'schoolOrCollege', 'degree', 'specialization', 'stream', 'yearOfPassing', 'percentage', 'cgpa'];
    for (const f of fields) { if (req.body[f] !== undefined) edu[f] = req.body[f]; }
    profile.lastUpdatedBy = req.user._id;
    await profile.save();
    res.json({ success: true, message: 'Education updated.', data: profile });
  } catch (err) { next(err); }
});

// ── DELETE /my/education/:eduId — remove education ──────────
router.delete('/my/education/:eduId', authenticate, async (req, res, next) => {
  try {
    const profile = await EmployeeProfile.findOne({ employee: req.user._id });
    if (!profile) return next(new ApiError(404, 'Profile not found.'));
    const edu = profile.education.id(req.params.eduId);
    if (!edu) return next(new ApiError(404, 'Education entry not found.'));
    if (edu.marksheetPublicId) await deleteFile(edu.marksheetPublicId).catch(() => {});
    if (edu.certificatePublicId) await deleteFile(edu.certificatePublicId).catch(() => {});
    profile.education.pull(req.params.eduId);
    profile.lastUpdatedBy = req.user._id;
    await profile.save();
    res.json({ success: true, message: 'Education removed.', data: profile });
  } catch (err) { next(err); }
});

// ── POST /my/education/:eduId/marksheet — upload marksheet ──
router.post('/my/education/:eduId/marksheet', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return next(new ApiError(400, 'No file uploaded.'));
    const profile = await EmployeeProfile.findOne({ employee: req.user._id });
    if (!profile) return next(new ApiError(404, 'Profile not found.'));
    const edu = profile.education.id(req.params.eduId);
    if (!edu) return next(new ApiError(404, 'Education entry not found.'));
    if (edu.marksheetPublicId) await deleteFile(edu.marksheetPublicId, rType(req.file.mimetype)).catch(() => {});
    const pubId = `hrms/profiles/${req.user._id}/edu/${Date.now()}_marksheet`;
    const result = await uploadBuffer(req.file.buffer, '', pubId, rType(req.file.mimetype));
    edu.marksheetUrl = result.secure_url;
    edu.marksheetPublicId = result.public_id;
    profile.lastUpdatedBy = req.user._id;
    await profile.save();
    res.json({ success: true, message: 'Marksheet uploaded.', data: profile });
  } catch (err) { next(err); }
});

// ── POST /my/experience — add experience entry ──────────────
router.post('/my/experience', authenticate, async (req, res, next) => {
  try {
    const { companyName, designation, department, location, fromDate, toDate, ctcPerAnnum, reasonForLeaving } = req.body;
    if (!companyName?.trim()) return next(new ApiError(400, 'Company name is required.'));
    let profile = await EmployeeProfile.findOne({ employee: req.user._id });
    if (!profile) profile = await EmployeeProfile.create({ employee: req.user._id });
    profile.experience.push({ companyName, designation, department, location, fromDate, toDate, ctcPerAnnum, reasonForLeaving });
    profile.isFresher = false;
    profile.lastUpdatedBy = req.user._id;
    await profile.save();
    res.status(201).json({ success: true, message: 'Experience added.', data: profile });
  } catch (err) { next(err); }
});

// ── PATCH /my/experience/:expId — update experience entry ───
router.patch('/my/experience/:expId', authenticate, async (req, res, next) => {
  try {
    const profile = await EmployeeProfile.findOne({ employee: req.user._id });
    if (!profile) return next(new ApiError(404, 'Profile not found.'));
    const exp = profile.experience.id(req.params.expId);
    if (!exp) return next(new ApiError(404, 'Experience entry not found.'));
    const fields = ['companyName', 'designation', 'department', 'location', 'fromDate', 'toDate', 'ctcPerAnnum', 'reasonForLeaving'];
    for (const f of fields) { if (req.body[f] !== undefined) exp[f] = req.body[f]; }
    profile.lastUpdatedBy = req.user._id;
    await profile.save();
    res.json({ success: true, message: 'Experience updated.', data: profile });
  } catch (err) { next(err); }
});

// ── DELETE /my/experience/:expId — remove experience ────────
router.delete('/my/experience/:expId', authenticate, async (req, res, next) => {
  try {
    const profile = await EmployeeProfile.findOne({ employee: req.user._id });
    if (!profile) return next(new ApiError(404, 'Profile not found.'));
    const exp = profile.experience.id(req.params.expId);
    if (!exp) return next(new ApiError(404, 'Experience entry not found.'));
    for (const f of ['experienceLetterPublicId', 'relievingLetterPublicId', 'offerLetterPublicId']) {
      if (exp[f]) await deleteFile(exp[f]).catch(() => {});
    }
    profile.experience.pull(req.params.expId);
    if (profile.experience.length === 0) profile.isFresher = true;
    profile.lastUpdatedBy = req.user._id;
    await profile.save();
    res.json({ success: true, message: 'Experience removed.', data: profile });
  } catch (err) { next(err); }
});

// ── POST /my/experience/:expId/:docType — upload exp document
router.post('/my/experience/:expId/:docType', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    const validTypes = ['experienceLetter', 'relievingLetter', 'offerLetter'];
    if (!validTypes.includes(req.params.docType)) return next(new ApiError(400, 'Invalid document type.'));
    if (!req.file) return next(new ApiError(400, 'No file uploaded.'));
    const profile = await EmployeeProfile.findOne({ employee: req.user._id });
    if (!profile) return next(new ApiError(404, 'Profile not found.'));
    const exp = profile.experience.id(req.params.expId);
    if (!exp) return next(new ApiError(404, 'Experience entry not found.'));
    const urlField = `${req.params.docType}Url`;
    const idField  = `${req.params.docType}PublicId`;
    if (exp[idField]) await deleteFile(exp[idField], rType(req.file.mimetype)).catch(() => {});
    const pubId = `hrms/profiles/${req.user._id}/exp/${Date.now()}_${req.params.docType}`;
    const result = await uploadBuffer(req.file.buffer, '', pubId, rType(req.file.mimetype));
    exp[urlField] = result.secure_url;
    exp[idField]  = result.public_id;
    profile.lastUpdatedBy = req.user._id;
    await profile.save();
    res.json({ success: true, message: `${req.params.docType} uploaded.`, data: profile });
  } catch (err) { next(err); }
});

// ── POST /my/documents — upload identity/other document ─────
router.post('/my/documents', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return next(new ApiError(400, 'No file uploaded.'));
    const { label, category } = req.body;
    if (!label?.trim()) return next(new ApiError(400, 'Document label is required.'));
    let profile = await EmployeeProfile.findOne({ employee: req.user._id });
    if (!profile) profile = await EmployeeProfile.create({ employee: req.user._id });
    const pubId = `hrms/profiles/${req.user._id}/docs/${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
    const result = await uploadBuffer(req.file.buffer, '', pubId, rType(req.file.mimetype));
    profile.documents.push({
      label: label.trim(),
      category: category || 'OTHER',
      fileUrl: result.secure_url,
      publicId: result.public_id,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });
    profile.lastUpdatedBy = req.user._id;
    await profile.save();
    res.status(201).json({ success: true, message: 'Document uploaded.', data: profile });
  } catch (err) { next(err); }
});

// ── DELETE /my/documents/:docId — remove document ───────────
router.delete('/my/documents/:docId', authenticate, async (req, res, next) => {
  try {
    const profile = await EmployeeProfile.findOne({ employee: req.user._id });
    if (!profile) return next(new ApiError(404, 'Profile not found.'));
    const doc = profile.documents.id(req.params.docId);
    if (!doc) return next(new ApiError(404, 'Document not found.'));
    if (doc.publicId) await deleteFile(doc.publicId).catch(() => {});
    profile.documents.pull(req.params.docId);
    profile.lastUpdatedBy = req.user._id;
    await profile.save();
    res.json({ success: true, message: 'Document removed.', data: profile });
  } catch (err) { next(err); }
});

module.exports = router;
