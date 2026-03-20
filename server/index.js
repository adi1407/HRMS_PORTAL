require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { initCronJobs } = require('./cron');
const { ensureFaceApi, getFaceModelsDebugInfo } = require('./services/faceEncoder.service');

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 HRMS Server running on http://localhost:${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV}`);
    console.log(`🌐 Frontend URL: ${process.env.CLIENT_URL}`);
    const faceDebug = getFaceModelsDebugInfo();
    console.log(`🧠 Face models dir: ${faceDebug.modelsDir}`);
    if (!faceDebug.modelFilesPresent) {
      console.warn(`⚠️ Missing face model files: ${faceDebug.missingModelFiles.join(', ')}`);
    }
    initCronJobs();
    console.log('⏰ Cron jobs initialized\n');
    // Warm face models in background so first mobile face encode/check-in is faster on cold boot.
    ensureFaceApi()
      .then(() => console.log('🙂 Face models preloaded'))
      .catch((err) => console.error('[Face Preload] failed:', err?.message || err));
  });
});
