require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// Minimal inline schemas to avoid hook side effects
const UserSchema = new mongoose.Schema({ employeeId: String, name: String, email: { type: String, lowercase: true }, password: String, role: String, department: mongoose.Schema.Types.ObjectId, branch: mongoose.Schema.Types.ObjectId, designation: String, joiningDate: Date, grossSalary: Number, isActive: { type: Boolean, default: true }, faceDescriptors: { type: [[Number]], default: [] }, faceEnrolled: { type: Boolean, default: false } }, { timestamps: true });
const BranchSchema = new mongoose.Schema({ name: String, address: String, floor: Number, latitude: Number, longitude: Number, radiusMeters: Number, isActive: { type: Boolean, default: true } }, { timestamps: true });
const DepartmentSchema = new mongoose.Schema({ name: String, code: String, isActive: { type: Boolean, default: true } }, { timestamps: true });
const HolidaySchema = new mongoose.Schema({ name: String, date: Date, type: String }, { timestamps: true });

const User       = mongoose.model('User',       UserSchema);
const Branch     = mongoose.model('Branch',     BranchSchema);
const Department = mongoose.model('Department', DepartmentSchema);
const Holiday    = mongoose.model('Holiday',    HolidaySchema);

async function seed() {
  console.log('\n🌱 HRMS Seed Script\n' + '─'.repeat(40));

  try {
    await mongoose.connect(process.env.MONGODB_URI, { family: 4, serverSelectionTimeoutMS: 15000 });
    console.log('✅ Connected to MongoDB\n');

    // Branches
    const branchDefs = [
      { name: 'HR Branch',  address: 'Floor 1, HR Wing',  floor: 1, latitude: 28.58710778509545, longitude: 77.3156682992218, radiusMeters: 30 },
      { name: 'IT Branch',  address: 'Floor 2, IT Wing',  floor: 2, latitude: 28.58710778509545, longitude: 77.3156682992218, radiusMeters: 30 },
    ];
    let branch; // used for admin assignment (HR Branch)
    for (const def of branchDefs) {
      let b = await Branch.findOne({ name: def.name });
      if (b) {
        console.log(`⏭  Branch exists: ${b.name}`);
      } else {
        b = await Branch.create({ ...def, isActive: true });
        console.log(`✅ Branch created: ${b.name}`);
      }
      if (def.name === 'HR Branch') branch = b;
    }
    console.log(`   ⚠️  Update GPS coordinates for each branch after login!\n`);

    // Departments
    const deptDefs = [
      { name: 'Human Resources', code: 'HR' },
      { name: 'Information Technology', code: 'IT' },
    ];
    let dept;
    for (const def of deptDefs) {
      let d = await Department.findOne({ code: def.code });
      if (d) {
        console.log(`⏭  Department exists: ${d.name}`);
      } else {
        d = await Department.create({ ...def, isActive: true });
        console.log(`✅ Department created: ${d.name}`);
      }
      if (def.code === 'HR') dept = d;
    }

    // Super Admin
    let admin = await User.findOne({ email: 'admin@hrms.com' });
    if (admin) {
      console.log(`⏭  Super Admin exists: ${admin.email}`);
    } else {
      const hashedPassword = await bcrypt.hash('Admin@123', 12);
      admin = await User.create({
        employeeId:  'EMP-0001',
        name:        'Super Admin',
        email:       'admin@hrms.com',
        password:    hashedPassword,
        role:        'SUPER_ADMIN',
        designation: 'System Administrator',
        department:  dept._id,
        branch:      branch._id,
        joiningDate: new Date(),
        grossSalary: 0,
        isActive:    true,
      });
      console.log(`\n✅ Super Admin created!`);
      console.log(`   📧 Email:    admin@hrms.com`);
      console.log(`   🔑 Password: Admin@123`);
      console.log(`   ⚠️  Change this password after first login!\n`);
    }

    // Indian National Holidays
    const year = new Date().getFullYear();
    const holidays = [
      { name: 'Republic Day',     date: new Date(year, 0, 26), type: 'NATIONAL' },
      { name: 'Independence Day', date: new Date(year, 7, 15), type: 'NATIONAL' },
      { name: 'Gandhi Jayanti',   date: new Date(year, 9, 2),  type: 'NATIONAL' },
      { name: 'Christmas Day',    date: new Date(year, 11, 25), type: 'NATIONAL' },
    ];
    let created = 0;
    for (const h of holidays) {
      const exists = await Holiday.findOne({ name: h.name, date: h.date });
      if (!exists) { await Holiday.create(h); created++; }
    }
    console.log(`✅ Holidays: ${created} created\n`);

    console.log('═'.repeat(40));
    console.log('🎉 SEED COMPLETE!\n');
    console.log('📋 LOGIN DETAILS:');
    console.log('   URL:      http://localhost:3000');
    console.log('   Email:    admin@hrms.com');
    console.log('   Password: Admin@123\n');
    console.log('📋 BRANCH ID: ' + branch._id);
    console.log('   (You will need this for check-in testing)\n');

  } catch (err) {
    console.error('\n❌ Seed failed:', err.message);
    if (err.message.includes('ECONNREFUSED') || err.message.includes('querySrv')) {
      console.error('   → Check your MONGODB_URI in server/.env');
      console.error('   → Make sure MongoDB Atlas IP whitelist includes 0.0.0.0/0');
    }
    if (err.message.includes('authentication')) {
      console.error('   → Wrong username/password in MONGODB_URI');
    }
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
