import { Router } from 'express';
import { showLogin, doLogin, doLogout } from './controllers/authController.js';
import { dashboard } from './controllers/dashboardController.js';
import { page as usersPage, create as usersCreate, update as usersUpdate, deactivate as usersDeactivate, activate as usersActivate, resetPassword as usersResetPassword } from './controllers/userController.js';
import { page as membersPage, create as membersCreate, update as membersUpdate, softDelete as membersDelete, activate as membersActivate } from './controllers/memberController.js';
import { page as txPage, create as txCreate, voidTx as txVoid, refreshMemberBalance } from './controllers/transactionController.js';
import { savingsWajibIndex, savingsWajibDetail, savingsPokokPage } from './controllers/savingsController.js';

import { requireAuth } from './middleware/authMiddleware.js';
import { requireRole } from './middleware/roleMiddleware.js';

const router = Router();

// Auth
router.get('/login', showLogin);
router.post('/login', doLogin);
router.post('/logout', doLogout);

// Dashboard (pakai partials)
router.get('/', requireAuth, dashboard);

// === User Management (ADMIN only) ===
router.get('/users', requireAuth, requireRole('ADMIN'), usersPage);
router.post('/users', requireAuth, requireRole('ADMIN'), usersCreate);
router.post('/users/:id', requireAuth, requireRole('ADMIN'), usersUpdate);
router.post('/users/:id/deactivate', requireAuth, requireRole('ADMIN'), usersDeactivate);
router.post('/users/:id/activate', requireAuth, requireRole('ADMIN'), usersActivate);
router.post('/users/:id/reset-password', requireAuth, requireRole('ADMIN'), usersResetPassword);

// Members (satu view + modal tambah/edit)
router.get('/members', requireAuth, membersPage);
router.post('/members', requireAuth, requireRole('ADMIN', 'STAFF'), membersCreate);
router.post('/members/:id', requireAuth, requireRole('ADMIN', 'STAFF'), membersUpdate);
router.post('/members/:id/delete', requireAuth, requireRole('ADMIN'), membersDelete);
router.post('/members/:id/activate', requireAuth, requireRole('ADMIN'), membersActivate);

// Transactions
router.get('/transactions', requireAuth, txPage);
router.post('/transactions', requireAuth, requireRole('ADMIN', 'STAFF'), txCreate);
router.post('/transactions/:code/void', requireAuth, requireRole('ADMIN', 'STAFF'), txVoid);
router.post('/transactions/refresh-cache', requireAuth, requireRole('ADMIN', 'STAFF'), refreshMemberBalance);

// Savings
router.get('/savings/wajib', requireAuth, requireRole('ADMIN', 'STAFF'), savingsWajibIndex);
router.get('/savings/wajib/:memberId', requireAuth, requireRole('ADMIN', 'STAFF'), savingsWajibDetail);
router.get('/savings/pokok', requireAuth, requireRole('ADMIN', 'STAFF'), savingsPokokPage);

export default router;
