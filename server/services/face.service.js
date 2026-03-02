const User = require('../models/User.model');
const { ApiError } = require('../utils/api.utils');

const FACE_MATCH_THRESHOLD = 0.55;

const euclideanDistance = (d1, d2) => {
  let sum = 0;
  for (let i = 0; i < d1.length; i++) sum += (d1[i] - d2[i]) ** 2;
  return Math.sqrt(sum);
};

const verifyFace = async (employeeId, incomingDescriptor) => {
  if (!Array.isArray(incomingDescriptor) || incomingDescriptor.length !== 128) {
    throw new ApiError(400, 'Invalid face descriptor. Expected 128-element array.');
  }

  const user = await User.findById(employeeId).select('+faceDescriptors');
  if (!user) throw new ApiError(404, 'Employee not found.');
  if (!user.faceEnrolled || !user.faceDescriptors?.length) {
    throw new ApiError(400, 'Face not enrolled. Contact HR to enroll your face.');
  }

  const distances = user.faceDescriptors.map(stored => euclideanDistance(stored, incomingDescriptor));
  const minDistance = Math.min(...distances);

  return {
    matched:    minDistance <= FACE_MATCH_THRESHOLD,
    confidence: Math.round((1 - minDistance) * 100),
    distance:   parseFloat(minDistance.toFixed(4)),
  };
};

const enrollFace = async (employeeId, descriptors, enrolledBy) => {
  if (!Array.isArray(descriptors) || descriptors.length < 3) {
    throw new ApiError(400, 'At least 3 face descriptors required.');
  }

  const user = await User.findByIdAndUpdate(
    employeeId,
    { faceDescriptors: descriptors, faceEnrolled: true, faceEnrolledAt: new Date(), faceEnrolledBy: enrolledBy._id },
    { new: true }
  );
  if (!user) throw new ApiError(404, 'Employee not found.');
  return user;
};

const deleteFaceEnrollment = async (employeeId) => {
  const user = await User.findByIdAndUpdate(
    employeeId,
    { faceDescriptors: [], faceEnrolled: false, faceEnrolledAt: null, faceEnrolledBy: null },
    { new: true }
  );
  if (!user) throw new ApiError(404, 'Employee not found.');
  return user;
};

module.exports = { verifyFace, enrollFace, deleteFaceEnrollment };
