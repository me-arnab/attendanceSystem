import mongoose from 'mongoose';
import { Company } from '../models/Company';
import { User } from '../models/User';
import { Department } from '../models/Department';
import { Attendance } from '../models/Attendance';
import { AuditLog } from '../models/AuditLog';
import { connectDB } from '../config/db';
import { getTimezoneDateInfo } from '../services/attendanceService';

export const seedDatabase = async () => {
  console.log('[Seed] Starting development database seeding...');
  await connectDB();

  // Clear existing collections
  await Promise.all([
    Company.deleteMany({}),
    User.deleteMany({}),
    Department.deleteMany({}),
    Attendance.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  console.log('[Seed] Cleared existing data.');

  // 1. Seed Super Admin
  const superAdmin = await User.create({
    fullName: 'Global Platform Admin',
    email: 'superadmin@saas.com',
    password: 'Admin@12345',
    role: 'SUPER_ADMIN',
    status: 'active',
    phone: '+1 800-555-0100',
    designation: 'Platform Director',
  });
  console.log('[Seed] Created Super Admin: superadmin@saas.com');

  // 2. Seed Company 1: Nexus Global Technologies
  const nexusCompany = await Company.create({
    name: 'Nexus Global Technologies',
    code: 'NEXUS',
    email: 'contact@nexus.com',
    phone: '+1 415-555-2671',
    address: '100 Silicon Way, San Francisco, CA',
    status: 'active',
    settings: {
      timezone: 'America/New_York',
      officeStartTime: '09:00',
      officeEndTime: '18:00',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      lateThresholdMinutes: 15,
      logoUrl: '',
    },
  });

  const nexusAdmin = await User.create({
    companyId: nexusCompany._id,
    fullName: 'Robert Sterling',
    email: 'admin@nexus.com',
    password: 'Nexus@12345',
    role: 'COMPANY_ADMIN',
    status: 'active',
    phone: '+1 415-555-2672',
    designation: 'VP of People & Operations',
  });

  const nexusDeptEng = await Department.create({
    companyId: nexusCompany._id,
    name: 'Engineering',
    description: 'Software development, cloud architecture, and systems',
    status: 'active',
  });

  const nexusDeptProduct = await Department.create({
    companyId: nexusCompany._id,
    name: 'Product & Design',
    description: 'Product lifecycle and user experience design',
    status: 'active',
  });

  const nexusDeptOps = await Department.create({
    companyId: nexusCompany._id,
    name: 'DevOps & IT',
    description: 'Infrastructure, deployment pipelines and IT support',
    status: 'active',
  });

  const nexusEmployees = [
    await User.create({
      companyId: nexusCompany._id,
      fullName: 'John Doe',
      email: 'john.doe@nexus.com',
      password: 'Emp@12345',
      role: 'EMPLOYEE',
      status: 'active',
      employeeId: 'EMP-1001',
      phone: '+1 415-555-3001',
      departmentId: nexusDeptEng._id,
      designation: 'Senior Software Engineer',
      joiningDate: new Date('2023-01-15'),
    }),
    await User.create({
      companyId: nexusCompany._id,
      fullName: 'Jane Smith',
      email: 'jane.smith@nexus.com',
      password: 'Emp@12345',
      role: 'EMPLOYEE',
      status: 'active',
      employeeId: 'EMP-1002',
      phone: '+1 415-555-3002',
      departmentId: nexusDeptProduct._id,
      designation: 'Lead UI/UX Designer',
      joiningDate: new Date('2023-03-01'),
    }),
    await User.create({
      companyId: nexusCompany._id,
      fullName: 'Alex Wong',
      email: 'alex.wong@nexus.com',
      password: 'Emp@12345',
      role: 'EMPLOYEE',
      status: 'active',
      employeeId: 'EMP-1003',
      phone: '+1 415-555-3003',
      departmentId: nexusDeptOps._id,
      designation: 'Cloud Solutions Architect',
      joiningDate: new Date('2023-06-20'),
    }),
  ];

  console.log('[Seed] Created Nexus Global Technologies with Admin and 3 Employees.');

  // 3. Seed Company 2: Apex Dynamics Corp
  const apexCompany = await Company.create({
    name: 'Apex Dynamics Corp',
    code: 'APEX',
    email: 'info@apexdynamics.com',
    phone: '+1 212-555-4819',
    address: '450 Lexington Ave, New York, NY',
    status: 'active',
    settings: {
      timezone: 'America/New_York',
      officeStartTime: '09:30',
      officeEndTime: '18:30',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      lateThresholdMinutes: 20,
    },
  });

  const apexAdmin = await User.create({
    companyId: apexCompany._id,
    fullName: 'Eleanor Vance',
    email: 'admin@apex.com',
    password: 'Apex@12345',
    role: 'COMPANY_ADMIN',
    status: 'active',
    phone: '+1 212-555-4820',
    designation: 'Chief Administrative Officer',
  });

  const apexDeptSales = await Department.create({
    companyId: apexCompany._id,
    name: 'Enterprise Sales',
    description: 'Corporate client acquisition and renewals',
    status: 'active',
  });

  const apexDeptHR = await Department.create({
    companyId: apexCompany._id,
    name: 'Human Resources',
    description: 'Talent management and employee relations',
    status: 'active',
  });

  const apexEmployees = [
    await User.create({
      companyId: apexCompany._id,
      fullName: 'Sarah Jenkins',
      email: 'sarah.jenkins@apex.com',
      password: 'Emp@12345',
      role: 'EMPLOYEE',
      status: 'active',
      employeeId: 'APX-2001',
      phone: '+1 212-555-5001',
      departmentId: apexDeptSales._id,
      designation: 'Senior Account Executive',
      joiningDate: new Date('2023-05-10'),
    }),
    await User.create({
      companyId: apexCompany._id,
      fullName: 'Michael Brown',
      email: 'michael.brown@apex.com',
      password: 'Emp@12345',
      role: 'EMPLOYEE',
      status: 'active',
      employeeId: 'APX-2002',
      phone: '+1 212-555-5002',
      departmentId: apexDeptHR._id,
      designation: 'HR Specialist',
      joiningDate: new Date('2023-08-01'),
    }),
  ];

  console.log('[Seed] Created Apex Dynamics Corp with Admin and 2 Employees.');

  // 4. Seed Attendance History for Nexus employees (past 5 calendar days)
  const now = new Date();
  const timezoneNexus = nexusCompany.settings.timezone;

  for (let dayOffset = 4; dayOffset >= 0; dayOffset--) {
    const dayDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    const dateStr = getTimezoneDateInfo(dayDate, timezoneNexus).dateString;

    for (let i = 0; i < nexusEmployees.length; i++) {
      const emp = nexusEmployees[i];
      // John Doe is always Present early
      // Jane Smith is sometimes Late
      // Alex Wong is Present or Late
      const isLate = (i === 1 && dayOffset % 2 === 1) || (i === 2 && dayOffset === 2);
      const status = isLate ? 'LATE' : 'PRESENT';

      const checkInHour = isLate ? 9 : 8;
      const checkInMinute = isLate ? 35 : 45;

      const checkInTime = new Date(dayDate);
      checkInTime.setHours(checkInHour, checkInMinute, 0, 0);

      const checkOutTime = new Date(dayDate);
      checkOutTime.setHours(18, 15, 0, 0);

      const workingMinutes = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));

      await Attendance.create({
        companyId: nexusCompany._id,
        employeeId: emp._id,
        date: dateStr,
        checkIn: checkInTime,
        checkOut: dayOffset === 0 ? null : checkOutTime, // Today check-out left open
        status,
        workingMinutes: dayOffset === 0 ? 0 : workingMinutes,
        isManualCorrection: false,
      });
    }
  }

  // 5. Seed Attendance History for Apex employees
  const timezoneApex = apexCompany.settings.timezone;
  for (let dayOffset = 3; dayOffset >= 0; dayOffset--) {
    const dayDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    const dateStr = getTimezoneDateInfo(dayDate, timezoneApex).dateString;

    for (const emp of apexEmployees) {
      const checkInTime = new Date(dayDate);
      checkInTime.setHours(9, 15, 0, 0);
      const checkOutTime = new Date(dayDate);
      checkOutTime.setHours(18, 30, 0, 0);
      const workingMinutes = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));

      await Attendance.create({
        companyId: apexCompany._id,
        employeeId: emp._id,
        date: dateStr,
        checkIn: checkInTime,
        checkOut: dayOffset === 0 ? null : checkOutTime,
        status: 'PRESENT',
        workingMinutes: dayOffset === 0 ? 0 : workingMinutes,
        isManualCorrection: false,
      });
    }
  }

  // 6. Seed Initial Audit Logs
  await AuditLog.create({
    actorId: superAdmin._id,
    actorName: superAdmin.fullName,
    actorRole: superAdmin.role,
    action: 'PLATFORM_INITIALIZED',
    entityType: 'System',
    entityId: 'global',
    details: { environment: 'development' },
  });

  await AuditLog.create({
    companyId: nexusCompany._id,
    actorId: superAdmin._id,
    actorName: superAdmin.fullName,
    actorRole: superAdmin.role,
    action: 'COMPANY_CREATED',
    entityType: 'Company',
    entityId: nexusCompany._id.toString(),
    details: { name: nexusCompany.name, code: nexusCompany.code },
  });

  await AuditLog.create({
    companyId: apexCompany._id,
    actorId: superAdmin._id,
    actorName: superAdmin.fullName,
    actorRole: superAdmin.role,
    action: 'COMPANY_CREATED',
    entityType: 'Company',
    entityId: apexCompany._id.toString(),
    details: { name: apexCompany.name, code: apexCompany.code },
  });

  console.log('[Seed] Database seeding completed successfully!');
  console.log(`
=============================================================
  DEMO CREDENTIALS:
=============================================================
1. SUPER ADMIN:
   Email:    superadmin@saas.com
   Password: Admin@12345
   Role:     SUPER_ADMIN

2. COMPANY 1 (Nexus Global Technologies - NEXUS):
   Admin:    admin@nexus.com / Nexus@12345
   Employee: john.doe@nexus.com / Emp@12345 (EMP-1001)
   Employee: jane.smith@nexus.com / Emp@12345 (EMP-1002)

3. COMPANY 2 (Apex Dynamics Corp - APEX):
   Admin:    admin@apex.com / Apex@12345
   Employee: sarah.jenkins@apex.com / Emp@12345 (APX-2001)
=============================================================
  `);

  await mongoose.disconnect();
};

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed] Error during seeding:', err);
      process.exit(1);
    });
}
