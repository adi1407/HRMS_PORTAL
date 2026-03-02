require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { initCronJobs } = require('./cron');

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 HRMS Server running on http://localhost:${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV}`);
    console.log(`🌐 Frontend URL: ${process.env.CLIENT_URL}`);
    initCronJobs();
    console.log('⏰ Cron jobs initialized\n');
  });
});
