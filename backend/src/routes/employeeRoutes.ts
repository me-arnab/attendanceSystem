import { Router } from 'express';
import {
  getEmployeeDashboard,
  checkIn,
  checkOut,
  getMyAttendanceHistory,
} from '../controllers/employeeController';
import {
  getEmployeeHolidaysHandler,
  getEmployeeUpcomingHolidaysHandler,
} from '../controllers/holidayController';
import { authenticate } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';
import { requireTenant } from '../middleware/tenantMiddleware';

const router = Router();

// Enforce Employee role & Tenant scope
router.use(authenticate, authorizeRoles('EMPLOYEE'), requireTenant);

router.get('/dashboard', getEmployeeDashboard);
router.post('/attendance/checkin', checkIn);
router.post('/attendance/checkout', checkOut);
router.get('/attendance/history', getMyAttendanceHistory);

// Holidays
router.get('/holidays', getEmployeeHolidaysHandler);
router.get('/holidays/upcoming', getEmployeeUpcomingHolidaysHandler);

export default router;
