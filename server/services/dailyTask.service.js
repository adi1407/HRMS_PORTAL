const DailyTask = require('../models/DailyTask.model');
const User = require('../models/User.model');
const Department = require('../models/Department.model');
const { ApiError } = require('../utils/api.utils');

function startOfDay(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function sanitizeTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) throw new ApiError(400, 'At least one task is required.');
  if (tasks.length > 20) throw new ApiError(400, 'Maximum 20 tasks per day.');
  const out = [];
  for (const t of tasks) {
    if (!t.title?.trim()) throw new ApiError(400, 'Each task must have a title.');
    if (t.title.length > 200) throw new ApiError(400, 'Task title must be 200 chars or less.');
    if (t.description && t.description.length > 1000) throw new ApiError(400, 'Task description must be 1000 chars or less.');
    out.push({
      title: t.title.trim(),
      description: (t.description || '').trim(),
      status: ['COMPLETED', 'IN_PROGRESS', 'BLOCKED'].includes(t.status) ? t.status : 'IN_PROGRESS',
    });
  }
  return out;
}

async function getActiveDepartmentForHead(userId) {
  return Department.findOne({ head: userId, isActive: true })
    .populate('head', 'name employeeId');
}

async function assertHodManagesEmployee(hodId, employeeId) {
  const dept = await getActiveDepartmentForHead(hodId);
  if (!dept) throw new ApiError(403, 'You are not a head of department.');
  const emp = await User.findById(employeeId).select('department isActive name');
  if (!emp?.isActive) throw new ApiError(404, 'Employee not found.');
  if (!emp.department || emp.department.toString() !== dept._id.toString()) {
    throw new ApiError(400, 'That employee is not in your department.');
  }
  return { dept, employee: emp };
}

/** Ensure one user is head of at most one department; assign head and validate membership */
async function setDepartmentHeadUser(deptId, headUserId) {
  const dept = await Department.findById(deptId);
  if (!dept) throw new ApiError(404, 'Department not found.');
  if (!headUserId) {
    dept.head = null;
    await dept.save();
    return dept;
  }
  const headUser = await User.findById(headUserId).select('department name');
  if (!headUser) throw new ApiError(404, 'User not found.');
  if (!headUser.department || headUser.department.toString() !== dept._id.toString()) {
    throw new ApiError(400, 'Head of department must be an employee assigned to this department first.');
  }
  await Department.updateMany(
    { head: headUserId, _id: { $ne: dept._id } },
    { $unset: { head: 1 } }
  );
  dept.head = headUserId;
  await dept.save();
  return dept;
}

module.exports = {
  startOfDay,
  sanitizeTasks,
  getActiveDepartmentForHead,
  assertHodManagesEmployee,
  setDepartmentHeadUser,
};
