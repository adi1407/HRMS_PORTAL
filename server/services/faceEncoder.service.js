/**
 * Server-side face descriptor extraction using the same face-api.js models as the web client.
 * Mobile apps send JPEG frames here; we return a 128-D vector compatible with verifyFace / enrollFace.
 */
const path = require('path');
const fs = require('fs');
const { ApiError } = require('../utils/api.utils');

const REQUIRED_MODEL_FILES = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
];

const hasRequiredModelFiles = (dir) =>
  REQUIRED_MODEL_FILES.every((file) => fs.existsSync(path.join(dir, file)));

const getMissingModelFiles = (dir) =>
  REQUIRED_MODEL_FILES.filter((file) => !fs.existsSync(path.join(dir, file)));

function resolveModelsDir() {
  const candidates = [];
  if (process.env.FACE_MODELS_DIR) candidates.push(process.env.FACE_MODELS_DIR);

  // Common deploy layouts: monorepo root, server root, or nested app dir.
  candidates.push(
    path.join(__dirname, '../../client/public/models'),
    path.join(__dirname, '../../../client/public/models'),
    path.join(process.cwd(), 'client/public/models'),
    path.join(process.cwd(), '../client/public/models'),
    path.join(process.cwd(), '../../client/public/models')
  );

  for (const candidate of candidates) {
    const full = path.resolve(candidate);
    if (hasRequiredModelFiles(full)) return full;
  }

  // Keep first candidate for error context even if not found.
  return path.resolve(candidates[0] || path.join(__dirname, '../../client/public/models'));
}

const MODELS_DIR = resolveModelsDir();

let loadPromise = null;
let faceapi = null;

async function ensureFaceApi() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      if (!hasRequiredModelFiles(MODELS_DIR)) {
        const missing = getMissingModelFiles(MODELS_DIR);
        throw new ApiError(
          503,
          `Face model files not found in ${MODELS_DIR}. Missing: ${missing.join(', ')}. Set FACE_MODELS_DIR to the folder containing all face-api model files.`
        );
      }
      require('@tensorflow/tfjs');
      const canvas = require('canvas');
      faceapi = require('face-api.js');
      const { Canvas, Image, ImageData } = canvas;
      faceapi.env.monkeyPatch({ Canvas, Image, ImageData });
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_DIR),
        faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_DIR),
        faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_DIR),
      ]);
    } catch (err) {
      // Allow next request to retry model loading instead of permanently caching a rejected promise.
      loadPromise = null;
      throw err;
    }
  })();
  return loadPromise;
}

/**
 * @param {Buffer} imageBuffer — JPEG/PNG bytes
 * @returns {Promise<number[]>} 128-element descriptor
 */
async function encodeFaceDescriptorFromBuffer(imageBuffer) {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new ApiError(400, 'Invalid image.');
  }
  await ensureFaceApi();
  const { Image, createCanvas } = require('canvas');
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new ApiError(400, 'Could not decode image.'));
    img.src = imageBuffer;
  });

  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const detection = await faceapi
    .detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) {
    throw new ApiError(400, 'No face detected. Use good lighting and face the camera.');
  }

  return Array.from(detection.descriptor);
}

function getFaceModelsDebugInfo() {
  return {
    modelsDir: MODELS_DIR,
    modelFilesPresent: hasRequiredModelFiles(MODELS_DIR),
    missingModelFiles: getMissingModelFiles(MODELS_DIR),
  };
}

module.exports = { encodeFaceDescriptorFromBuffer, ensureFaceApi, getFaceModelsDebugInfo };
