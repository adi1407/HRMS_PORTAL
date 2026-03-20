/**
 * Server-side face descriptor extraction using the same face-api.js models as the web client.
 * Mobile apps send JPEG frames here; we return a 128-D vector compatible with verifyFace / enrollFace.
 */
const path = require('path');
const { ApiError } = require('../utils/api.utils');

/** Override when the API is deployed without the web client folder (copy `client/public/models` there). */
const MODELS_DIR = process.env.FACE_MODELS_DIR || path.join(__dirname, '../../client/public/models');

let loadPromise = null;
let faceapi = null;

async function ensureFaceApi() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
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

module.exports = { encodeFaceDescriptorFromBuffer, ensureFaceApi };
