import express from 'express';
import { auth } from '../middleware/authMiddleware';
import { getUsers, getTotalUsers, updateUserAccountType, deleteUser } from '../controllers/usersController';

const router: express.Router = express.Router();

// GET /api/users - list users (for frontend table)
router.get('/', auth, getUsers);

// GET /api/users/totalusers - get total users count (for dashboard)
router.get('/totalusers', auth, getTotalUsers);

// PUT /api/users/:gid/account-type - update user account type
router.put('/:gid/account-type', auth, updateUserAccountType);

// DELETE /api/users/:gid - delete user
router.delete('/:gid', auth, deleteUser);

export default router;


