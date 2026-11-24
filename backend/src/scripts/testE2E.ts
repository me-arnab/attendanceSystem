import { Types } from 'mongoose';

const API = 'http://localhost:5050/api';

const runTests = async () => {
  console.log('--- STARTING E2E INTEGRATION VERIFICATION ---');

  // Test 1: Super Admin Login
  console.log('1. Testing Super Admin Login...');
  const saLogin = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@saas.com', password: 'Admin@12345' }),
  });
  const saData = await saLogin.json();
  if (!saData.success || saData.data.user.role !== 'SUPER_ADMIN') {
    throw new Error('Super Admin login failed: ' + JSON.stringify(saData));
  }
  const saToken = saData.data.token;
  console.log('   ✓ Super Admin successfully authenticated.');

  // Test 2: Super Admin Platform Dashboard
  console.log('2. Fetching Platform Dashboard Metrics...');
  const saDash = await fetch(`${API}/super-admin/dashboard`, {
    headers: { Authorization: `Bearer ${saToken}` },
  });
  const saDashData = await saDash.json();
  if (!saDashData.success || saDashData.data.stats.totalCompanies < 2) {
    throw new Error('Dashboard stats validation failed: ' + JSON.stringify(saDashData));
  }
  console.log(`   ✓ Total Companies: ${saDashData.data.stats.totalCompanies}, Employees: ${saDashData.data.stats.totalEmployees}`);

  // Test 3: Create a New Company & Company Admin via Super Admin
  console.log('3. Creating New Company (OmniCorp)...');
  const uniqueCode = 'OMNI-' + Math.floor(1000 + Math.random() * 9000);
  const omniEmail = `admin-${Date.now()}@omnicorp.com`;
  const createCompRes = await fetch(`${API}/super-admin/companies`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${saToken}`,
    },
    body: JSON.stringify({
      name: 'OmniCorp Solutions',
      code: uniqueCode,
      email: 'contact@omnicorp.com',
      phone: '+1 555-888-9999',
      address: '777 Tower Plaza, Chicago, IL',
      adminFullName: 'Arthur Pendelton',
      adminEmail: omniEmail,
      adminPassword: 'Password@123',
      timezone: 'America/Chicago',
      officeStartTime: '09:00',
      officeEndTime: '17:30',
      workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      lateThresholdMinutes: 15,
    }),
  });
  const createCompData = await createCompRes.json();
  if (!createCompData.success) {
    throw new Error('Company creation failed: ' + JSON.stringify(createCompData));
  }
  const omniCompanyId = createCompData.data.company._id;
  console.log(`   ✓ Created OmniCorp (ID: ${omniCompanyId}, Code: ${uniqueCode}) and Admin (${omniEmail})`);

  // Test 4: OmniCorp Admin Login
  console.log('4. Logging in as OmniCorp Company Admin...');
  const omniAdminLogin = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: omniEmail, password: 'Password@123' }),
  });
  const omniAdminData = await omniAdminLogin.json();
  if (!omniAdminData.success || omniAdminData.data.user.role !== 'COMPANY_ADMIN') {
    throw new Error('OmniCorp admin login failed: ' + JSON.stringify(omniAdminData));
  }
  const omniAdminToken = omniAdminData.data.token;
  console.log('   ✓ OmniCorp Company Admin successfully authenticated.');

  // Test 5: OmniCorp Admin creates Department
  console.log('5. Creating Department (Cloud Engineering)...');
  const deptRes = await fetch(`${API}/company/departments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${omniAdminToken}`,
    },
    body: JSON.stringify({
      name: 'Cloud Engineering',
      description: 'Distributed architecture and systems',
      status: 'active',
    }),
  });
  const deptData = await deptRes.json();
  if (!deptData.success) {
    throw new Error('Department creation failed: ' + JSON.stringify(deptData));
  }
  const deptId = deptData.data._id;
  console.log(`   ✓ Created Department: Cloud Engineering (ID: ${deptId})`);

  // Test 6: OmniCorp Admin creates Employee
  console.log('6. Creating Employee (Bruce Wayne)...');
  const empEmail = `bruce-${Date.now()}@omnicorp.com`;
  const empRes = await fetch(`${API}/company/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${omniAdminToken}`,
    },
    body: JSON.stringify({
      fullName: 'Bruce Wayne',
      email: empEmail,
      password: 'Batman@123',
      employeeId: 'OMNI-007',
      phone: '+1 555-111-2222',
      departmentId: deptId,
      designation: 'Principal Security Architect',
      joiningDate: new Date().toISOString(),
      role: 'EMPLOYEE',
      status: 'active',
    }),
  });
  const empData = await empRes.json();
  if (!empData.success) {
    throw new Error('Employee creation failed: ' + JSON.stringify(empData));
  }
  console.log(`   ✓ Created Employee: Bruce Wayne (ID: ${empData.data.employeeId})`);

  // Test 7: Employee Login and Automatic Attendance Processing
  console.log('7. Logging in as Employee Bruce Wayne (Checking Automatic Attendance Creation)...');
  const empLogin = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: empEmail, password: 'Batman@123' }),
  });
  const empLoginData = await empLogin.json();
  if (!empLoginData.success || !empLoginData.data.todayAttendance) {
    throw new Error('Automatic attendance creation failed: ' + JSON.stringify(empLoginData));
  }
  const attendanceRecord = empLoginData.data.todayAttendance;
  const empToken = empLoginData.data.token;
  console.log(`   ✓ Automatic attendance verified! Status: ${attendanceRecord.status}, Date: ${attendanceRecord.date}, Check-in: ${attendanceRecord.checkIn}`);

  // Test 8: Employee Check-Out Action
  console.log('8. Employee Check-Out Action...');
  const checkoutRes = await fetch(`${API}/employee/attendance/checkout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${empToken}` },
  });
  const checkoutData = await checkoutRes.json();
  if (!checkoutData.success || !checkoutData.data.checkOut) {
    throw new Error('Employee checkout failed: ' + JSON.stringify(checkoutData));
  }
  console.log(`   ✓ Employee successfully checked out at: ${checkoutData.data.checkOut}`);

  // Test 9: Company Admin Manual Attendance Correction with Audit Reason
  console.log('9. Company Admin Manually Correcting Attendance with Audit Reason...');
  const correctRes = await fetch(`${API}/company/attendance/${attendanceRecord._id}/correction`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${omniAdminToken}`,
    },
    body: JSON.stringify({
      status: 'PRESENT',
      reason: 'Confirmed employee was on authorized client site in morning',
    }),
  });
  const correctData = await correctRes.json();
  if (!correctData.success || !correctData.data.isManualCorrection) {
    throw new Error('Manual attendance correction failed: ' + JSON.stringify(correctData));
  }
  console.log('   ✓ Attendance manually corrected and flagged isManualCorrection: true');

  // Test 10: Verify Company Audit Trail
  console.log('10. Verifying Company Audit Logs...');
  const auditRes = await fetch(`${API}/company/audit-logs`, {
    headers: { Authorization: `Bearer ${omniAdminToken}` },
  });
  const auditData = await auditRes.json();
  if (!auditData.success || auditData.data.length === 0) {
    throw new Error('Audit logs verification failed: ' + JSON.stringify(auditData));
  }
  const correctionLog = auditData.data.find((l: any) => l.action === 'ATTENDANCE_MANUAL_CORRECTION');
  if (!correctionLog) {
    throw new Error('Correction audit log missing!');
  }
  console.log(`   ✓ Audit log found: ${correctionLog.action} by ${correctionLog.actorName}`);

  // Test 11: Multi-Tenant Data Isolation Test
  console.log('11. Testing Multi-Tenant Data Isolation...');
  const apexAdminLogin = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@apex.com', password: 'Apex@12345' }),
  });
  const apexAdminToken = (await apexAdminLogin.json()).data.token;
  const apexEmployees = await (
    await fetch(`${API}/company/employees`, {
      headers: { Authorization: `Bearer ${apexAdminToken}` },
    })
  ).json();

  const leakedOmni = apexEmployees.data.employees.some((e: any) => e.email.includes('omnicorp.com'));
  const leakedNexus = apexEmployees.data.employees.some((e: any) => e.email.includes('nexus.com'));
  if (leakedOmni || leakedNexus) {
    throw new Error('CRITICAL TENANT LEAK DETECTED!');
  }
  console.log('   ✓ Multi-tenant data isolation strictly enforced: Zero cross-tenant leakage.');

  // Test 12: Suspend Company and Verify Access Revocation
  console.log('12. Suspending OmniCorp via Super Admin...');
  const suspendRes = await fetch(`${API}/super-admin/companies/${omniCompanyId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${saToken}`,
    },
    body: JSON.stringify({ status: 'suspended' }),
  });
  const suspendData = await suspendRes.json();
  if (!suspendData.success || suspendData.data.status !== 'suspended') {
    throw new Error('Suspension failed: ' + JSON.stringify(suspendData));
  }
  console.log('   ✓ OmniCorp status updated to "suspended"');

  console.log('13. Verifying Suspended Employee Blocked from Login...');
  const blockedLogin = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: empEmail, password: 'Batman@123' }),
  });
  const blockedData = await blockedLogin.json();
  if (blockedLogin.status !== 403 || blockedData.success !== false) {
    throw new Error('Suspended employee was not blocked! HTTP ' + blockedLogin.status);
  }
  console.log(`   ✓ Correctly blocked with HTTP 403: "${blockedData.error}"`);

  // Test 13: Reactivate Company
  console.log('14. Reactivating OmniCorp via Super Admin...');
  await fetch(`${API}/super-admin/companies/${omniCompanyId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${saToken}`,
    },
    body: JSON.stringify({ status: 'active' }),
  });
  const unblockedLogin = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: empEmail, password: 'Batman@123' }),
  });
  if (unblockedLogin.status !== 200) {
    throw new Error('Reactivated employee failed to log in!');
  }
  console.log('   ✓ Reactivated employee successfully logged in again.');

  console.log('=============================================================');
  console.log('ALL E2E INTEGRATION TESTS PASSED WITH 100% SUCCESS!');
  console.log('=============================================================');
};

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('E2E TEST FAILURE:', err);
    process.exit(1);
  });
