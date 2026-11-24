import { Router } from 'express';
import { login, getMe, logout } from '../controllers/authController';
import { getPlatformSettings } from '../controllers/superAdminController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.post('/login', login);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);
router.get('/platform-settings', getPlatformSettings);

export default router;
