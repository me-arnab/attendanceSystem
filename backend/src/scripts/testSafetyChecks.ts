import http from 'http';
import mongoose from 'mongoose';
import { createApp } from '../app';
import { connectDB } from '../config/db';
import { User } from '../models/User';
import { Company } from '../models/Company';
import { Department } from '../models/Department';
import { Attendance } from '../models/Attendance';
import { Holiday } from '../models/Holiday';
import { AuditLog } from '../models/AuditLog';

const PORT = 5054;
const BASE_URL = `http://localhost:${PORT}/api`;

const runSafetyChecks = async () => {
  console.log('========================================================');
  console.log('   ATTENDEASE CRITICAL SAFETY & ISOLATION TEST SUITE');
  console.log('========================================================\n');

  await connectDB();
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => resolve());
  });

  let passed = 0;
  const assert = (condition: boolean, msg: string) => {
    if (!condition) {
      throw new Error(`[FAIL] ${msg}`);
    }
    console.log(`[PASS] ${msg}`);
    passed++;
  };

  const createdCompanyIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];

  try {
    const ts = Date.now();
    const password = 'Password@123';

    // 1. Setup isolated test companies and users
    const companyA = await Company.create({
      name: 'Safety Alpha Corp',
      code: `SAFE_A_${ts}`,
      email: `alpha_${ts}@safety.test`,
      phone: '1112223333',
      address: '100 Alpha Way',
      status: 'active',
      settings: {
        timezone: 'UTC',
        officeStartTime: '09:00',
        officeEndTime: '18:00',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        lateThresholdMinutes: 15,
        attendanceMode: 'AUTO_ON_LOGIN',
        requireCheckOut: true,
        breakDurationMinutes: 0,
        halfDayThresholdHours: 4,
        overtimeThresholdHours: 9,
        autoCheckoutHoursAfterEnd: 2,
      },
    });
    createdCompanyIds.push(companyA._id as mongoose.Types.ObjectId);

    const companyB = await Company.create({
      name: 'Safety Beta Corp',
      code: `SAFE_B_${ts}`,
      email: `beta_${ts}@safety.test`,
      phone: '4445556666',
      address: '200 Beta Blvd',
      status: 'active',
      settings: {
        timezone: 'UTC',
        officeStartTime: '09:00',
        officeEndTime: '18:00',
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        lateThresholdMinutes: 15,
        attendanceMode: 'AUTO_ON_LOGIN',
        requireCheckOut: true,
        breakDurationMinutes: 0,
        halfDayThresholdHours: 4,
        overtimeThresholdHours: 9,
        autoCheckoutHoursAfterEnd: 2,
      },
    });
    createdCompanyIds.push(companyB._id as mongoose.Types.ObjectId);

    const deptA = await Department.create({
      companyId: companyA._id,
      name: 'Engineering',
      description: 'Alpha Eng',
      status: 'active',
    });

    const superAdminEmail = `sa_${ts}@safety.test`;
    const adminAEmail = `admin_a_${ts}@safety.test`;
    const empAEmail = `emp_a_${ts}@safety.test`;
    const adminBEmail = `admin_b_${ts}@safety.test`;
    const empBEmail = `emp_b_${ts}@safety.test`;

    const superAdmin = await User.create({
      fullName: 'Safety Super Admin',
      email: superAdminEmail,
      password,
      role: 'SUPER_ADMIN',
      status: 'active',
    });
    createdUserIds.push(superAdmin._id as mongoose.Types.ObjectId);

    const adminA = await User.create({
      fullName: 'Alpha Admin',
      email: adminAEmail,
      password,
      role: 'COMPANY_ADMIN',
      companyId: companyA._id,
      status: 'active',
    });
    createdUserIds.push(adminA._id as mongoose.Types.ObjectId);

    const empA = await User.create({
      fullName: 'Alpha Employee',
      email: empAEmail,
      password,
      role: 'EMPLOYEE',
      companyId: companyA._id,
      departmentId: deptA._id,
      employeeId: `ALPHA-${ts}`,
      status: 'active',
    });
    createdUserIds.push(empA._id as mongoose.Types.ObjectId);

    const adminB = await User.create({
      fullName: 'Beta Admin',
      email: adminBEmail,
      password,
      role: 'COMPANY_ADMIN',
      companyId: companyB._id,
      status: 'active',
    });
    createdUserIds.push(adminB._id as mongoose.Types.ObjectId);

    const empB = await User.create({
      fullName: 'Beta Employee',
      email: empBEmail,
      password,
      role: 'EMPLOYEE',
      companyId: companyB._id,
      employeeId: `BETA-${ts}`,
      status: 'active',
    });
    createdUserIds.push(empB._id as mongoose.Types.ObjectId);

    // 2. Health check
    const healthRes = await fetch(`${BASE_URL}/health`);
    assert(healthRes.status === 200, 'GET /api/health returns 200 OK');

    // 3. JWT Authentication checks
    const unauthRes = await fetch(`${BASE_URL}/auth/me`);
    assert(unauthRes.status === 401, 'Unauthenticated request to /api/auth/me is rejected with 401');

    const badJwtRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: 'Bearer invalid.jwt.token' },
    });
    assert(badJwtRes.status === 401, 'Malformed/invalid JWT is rejected with 401');

    // Login all test actors
    const login = async (email: string) => {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      return { status: res.status, data };
    };

    const saLogin = await login(superAdminEmail);
    const adminALogin = await login(adminAEmail);
    const empALogin = await login(empAEmail);
    const adminBLogin = await login(adminBEmail);
    const empBLogin = await login(empBEmail);

    assert(saLogin.status === 200 && saLogin.data.data.token, 'Super Admin login succeeds');
    assert(adminALogin.status === 200 && adminALogin.data.data.token, 'Company A Admin login succeeds');
    assert(empALogin.status === 200 && empALogin.data.data.token, 'Company A Employee login succeeds');
    assert(adminBLogin.status === 200 && adminBLogin.data.data.token, 'Company B Admin login succeeds');
    assert(empBLogin.status === 200 && empBLogin.data.data.token, 'Company B Employee login succeeds');

    const saToken = saLogin.data.data.token;
    const adminAToken = adminALogin.data.data.token;
    const empAToken = empALogin.data.data.token;
    const adminBToken = adminBLogin.data.data.token;
    const empBToken = empBLogin.data.data.token;

    // 4. Role-Based Access Control (RBAC)
    const empToCompany = await fetch(`${BASE_URL}/company/employees`, {
      headers: { Authorization: `Bearer ${empAToken}` },
    });
    assert(empToCompany.status === 403, 'RBAC: Employee blocked from /api/company/employees (403)');

    const empToSuper = await fetch(`${BASE_URL}/super-admin/companies`, {
      headers: { Authorization: `Bearer ${empAToken}` },
    });
    assert(empToSuper.status === 403, 'RBAC: Employee blocked from /api/super-admin/companies (403)');

    const adminToSuper = await fetch(`${BASE_URL}/super-admin/companies`, {
      headers: { Authorization: `Bearer ${adminAToken}` },
    });
    assert(adminToSuper.status === 403, 'RBAC: Company Admin blocked from /api/super-admin/companies (403)');

    const adminToEmp = await fetch(`${BASE_URL}/employee/dashboard`, {
      headers: { Authorization: `Bearer ${adminAToken}` },
    });
    assert(adminToEmp.status === 403, 'RBAC: Company Admin blocked from /api/employee/dashboard (403)');

    const saToDashboard = await fetch(`${BASE_URL}/super-admin/dashboard`, {
      headers: { Authorization: `Bearer ${saToken}` },
    });
    assert(saToDashboard.status === 200, 'RBAC: Super Admin allowed on /api/super-admin/dashboard (200)');

    // 5. Attendance session & checkout handling
    assert(Boolean(empALogin.data.data.todayAttendance), 'Attendance: Auto check-in created on employee login');
    const attId = empALogin.data.data.todayAttendance._id;

    // Second login on same day must reuse the existing daily attendance session (no duplicate)
    const empALogin2 = await login(empAEmail);
    assert(
      empALogin2.data.data.todayAttendance?._id === attId,
      'Attendance: Re-login on same day reuses existing attendance record'
    );

    const checkoutRes = await fetch(`${BASE_URL}/employee/attendance/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${empAToken}` },
    });
    const checkoutData = await checkoutRes.json();
    assert(checkoutRes.status === 200 && Boolean(checkoutData.data?.checkOut), 'Attendance: Employee checkout succeeds');

    // 6. Cross-tenant isolation on employees & attendance
    const adminBFetchEmpA = await fetch(`${BASE_URL}/company/employees/${empA._id}`, {
      headers: { Authorization: `Bearer ${adminBToken}` },
    });
    assert(
      adminBFetchEmpA.status === 404 || adminBFetchEmpA.status === 403,
      'Tenant Isolation: Company B Admin cannot access Company A employee by ID'
    );

    const adminBCorrectAttA = await fetch(`${BASE_URL}/company/attendance/${attId}/correction`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminBToken}`,
      },
      body: JSON.stringify({ status: 'ABSENT', reason: 'Cross-tenant tamper attempt' }),
    });
    assert(
      adminBCorrectAttA.status === 404 || adminBCorrectAttA.status === 403,
      'Tenant Isolation: Company B Admin cannot modify Company A attendance record'
    );

    // 7. Holiday handling & tenant isolation
    const holidayDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const createHolRes = await fetch(`${BASE_URL}/company/holidays`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAToken}`,
      },
      body: JSON.stringify({
        name: `Alpha Founder Day ${ts}`,
        description: 'Company A holiday',
        date: holidayDate,
        holidayType: 'COMPANY',
        isRecurring: false,
      }),
    });
    const createHolData = await createHolRes.json();
    assert(createHolRes.status === 201 || createHolRes.status === 200, 'Holiday: Company A Admin can create holiday');
    const holidayId = createHolData.data?._id;
    assert(Boolean(holidayId), 'Holiday: Created holiday returns _id');

    const empAHolRes = await fetch(`${BASE_URL}/employee/holidays/upcoming`, {
      headers: { Authorization: `Bearer ${empAToken}` },
    });
    const empAHolData = await empAHolRes.json();
    assert(
      empAHolRes.status === 200 &&
        Array.isArray(empAHolData.data) &&
        empAHolData.data.some((h: any) => h._id === holidayId),
      'Holiday: Company A Employee sees Company A upcoming holiday'
    );

    const empBHolRes = await fetch(`${BASE_URL}/employee/holidays`, {
      headers: { Authorization: `Bearer ${empBToken}` },
    });
    const empBHolData = await empBHolRes.json();
    const leakedHoliday = (empBHolData.data || []).some((h: any) => h._id === holidayId);
    assert(!leakedHoliday, 'Tenant Isolation: Company B Employee cannot see Company A holiday');

    // 8. Deactivated account restrictions
    const deactivateRes = await fetch(`${BASE_URL}/company/employees/${empA._id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAToken}`,
      },
      body: JSON.stringify({ status: 'inactive' }),
    });
    assert(deactivateRes.status === 200, 'Deactivation: Company A Admin deactivates Employee A');

    const deactivatedLogin = await login(empAEmail);
    assert(deactivatedLogin.status === 403, 'Deactivation: Deactivated employee is blocked from logging in (403)');

    const deactivatedTokenUse = await fetch(`${BASE_URL}/employee/dashboard`, {
      headers: { Authorization: `Bearer ${empAToken}` },
    });
    assert(
      deactivatedTokenUse.status === 401 || deactivatedTokenUse.status === 403,
      'Deactivation: Existing JWT of deactivated employee is rejected'
    );

    console.log(`\n========================================================`);
    console.log(`   ALL ${passed} SAFETY & ISOLATION CHECKS PASSED`);
    console.log(`========================================================`);
  } finally {
    await Attendance.deleteMany({ companyId: { $in: createdCompanyIds } });
    await Holiday.deleteMany({ companyId: { $in: createdCompanyIds } });
    await AuditLog.deleteMany({ companyId: { $in: createdCompanyIds } });
    await Department.deleteMany({ companyId: { $in: createdCompanyIds } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
    await Company.deleteMany({ _id: { $in: createdCompanyIds } });

    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
  }
};

runSafetyChecks()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('SAFETY CHECK FAILURE:', err);
    process.exit(1);
  });
