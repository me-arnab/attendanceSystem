import { Router } from 'express';
import {
  getDashboardMetrics,
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  toggleEmployeeStatus,
  getDepartments,
  createDepartment,
  updateDepartment,
  getAttendanceList,
  correctAttendance,
  getReports,
  getCompanySettings,
  updateCompanySettings,
  getCompanyAuditLogs,
} from '../controllers/companyAdminController';
import {
  getCompanyHolidaysHandler,
  createHolidayHandler,
  updateHolidayHandler,
  deleteHolidayHandler,
} from '../controllers/holidayController';
import { authenticate } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';

const router = Router();

// Multi-tenant protection: Authenticated + COMPANY_ADMIN + Scoped Tenant
router.use(authenticate, authorizeRoles('COMPANY_ADMIN'), requireTenant);

router.get('/dashboard', getDashboardMetrics);

// Employees
router.get('/employees', getEmployees);
router.get('/employees/:id', getEmployeeById);
router.post('/employees', createEmployee);
router.put('/employees/:id', updateEmployee);
router.patch('/employees/:id/status', toggleEmployeeStatus);

// Departments
router.get('/departments', getDepartments);
router.post('/departments', createDepartment);
router.put('/departments/:id', updateDepartment);

// Attendance & Corrections
router.get('/attendance', getAttendanceList);
router.patch('/attendance/:id/correction', correctAttendance);

// Reports
router.get('/reports', getReports);

// Holidays
router.get('/holidays', getCompanyHolidaysHandler);
router.post('/holidays', createHolidayHandler);
router.put('/holidays/:id', updateHolidayHandler);
router.delete('/holidays/:id', deleteHolidayHandler);

// Settings
router.get('/settings', getCompanySettings);
router.put('/settings', updateCompanySettings);

// Audit logs
router.get('/audit-logs', getCompanyAuditLogs);

export default router;
