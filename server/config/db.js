const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ MONGODB_URI missing in .env file!');
    process.exit(1);
  }

  console.log('🔗 Connecting to MongoDB...');

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      family: 4, // Force IPv4 — fixes Windows ECONNREFUSED
    });

    console.log(`✅ MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.once('open', createIndexes);

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Reconnecting...');
    });

  } catch (err) {
    console.error('\n❌ MongoDB connection failed:', err.message);

    if (err.message.includes('ECONNREFUSED') || err.message.includes('querySrv')) {
      console.error('\n📋 TROUBLESHOOTING STEPS:');
      console.error('1. Go to https://cloud.mongodb.com');
      console.error('2. Security → Network Access → Add IP: 0.0.0.0/0');
      console.error('3. Wait 2 minutes then retry\n');
    }

    if (err.message.includes('authentication') || err.message.includes('bad auth')) {
      console.error('\n📋 FIX: Wrong username/password in MONGODB_URI in server/.env\n');
    }

    process.exit(1);
  }
};

const createIndexes = async () => {
  try {
    const db = mongoose.connection.db;
    await db.collection('attendances').createIndex({ employee: 1, date: 1 }, { unique: true });
    await db.collection('attendances').createIndex({ date: 1, status: 1 });
    await db.collection('salaries').createIndex({ employee: 1, month: 1, year: 1 }, { unique: true });
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ employeeId: 1 }, { unique: true });
    await db.collection('auditlogs').createIndex({ createdAt: -1 });
    console.log('📑 DB indexes ensured');
  } catch (err) {
    // Indexes may already exist — safe to ignore
  }
};

module.exports = connectDB;
