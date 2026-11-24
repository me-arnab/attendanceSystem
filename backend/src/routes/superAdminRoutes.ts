import { Router } from 'express';
import {
  getDashboardStats,
  getCompanies,
  createCompany,
  getCompanyDetails,
  updateCompany,
  toggleCompanyStatus,
  toggleUserStatus,
  getPlatformSettings,
  updatePlatformSettings,
} from '../controllers/superAdminController';
import { authenticate } from '../middleware/authMiddleware';
import { authorizeRoles } from '../middleware/roleMiddleware';

const router = Router();

// Public endpoint to read platform branding & configuration
router.get('/settings', getPlatformSettings);

// Enforce authentication & Super Admin role for all management operations
router.use(authenticate, authorizeRoles('SUPER_ADMIN'));

router.get('/dashboard', getDashboardStats);
router.get('/companies', getCompanies);
router.post('/companies', createCompany);
router.get('/companies/:id', getCompanyDetails);
router.put('/companies/:id', updateCompany);
router.patch('/companies/:id/status', toggleCompanyStatus);
router.patch('/users/:id/status', toggleUserStatus);

router.put('/settings', updatePlatformSettings);

export default router;
