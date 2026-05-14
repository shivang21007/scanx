import { Request, Response } from 'express';
import { UsersModel, UserStatus, AccountType } from '../models/Users';
import { getRequestLogger } from '../logger/logger';
import { enqueueDevicePurgeJobs } from '../queues/devicePurgeQueue';

export async function getUsers(req: Request, res: Response) {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const pageSize = Math.max(1, Math.min(200, parseInt(String(req.query.pageSize || '50'), 10)));
  const search = String(req.query.search || '').trim();
  const enrollment = req.query.enrollment as 'enrolled' | 'un-enrolled' | undefined;
  const createdSortParam = req.query.createdSort;
  const createdSort = (createdSortParam === 'asc' || createdSortParam === 'desc') ? createdSortParam : null;
  const statusParam = req.query.status;
  const status: UserStatus | undefined =
    statusParam === 'active' || statusParam === 'inactive' ? statusParam : undefined;
  const accountTypeParam = req.query.account_type;
  const account_type: AccountType | undefined =
    accountTypeParam === 'user' || accountTypeParam === 'service' ? accountTypeParam : undefined;
  const offset = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    UsersModel.list({ search, limit: pageSize, offset, enrollment, createdSort, status, account_type }),
    UsersModel.count({ search, enrollment, status, account_type }),
  ]);

  res.json({ items, total, page, pageSize });
}

export async function createUser(req: Request, res: Response) {
  const log = getRequestLogger(req);
  try {
    const { name, email, account_type } = req.body;
    
    // Validate required fields
    if (!name || !email || !account_type) {
      return res.status(400).json({ message: 'Name, email, and account type are required' });
    }

    // Check if user with this email already exists
    const existingUser = await UsersModel.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ 
        message: 'A user with this email already exists',
        error: 'DUPLICATE_EMAIL'
      });
    }

    // Create the user
    const user = await UsersModel.create(name, email, account_type);
    if (!user) {
      return res.status(400).json({ message: 'Failed to create user' });
    }
    
    res.status(201).json({ message: 'User created successfully', user });
  } catch (error: any) {
    log.error('users_create_failed', { error: error?.message, code: error?.code });
    
    // Fallback: Check for duplicate email error (in case of race condition)
    if (error.code === 'ER_DUP_ENTRY' && error.sqlMessage?.includes('email')) {
      return res.status(409).json({ 
        message: 'A user with this email already exists',
        error: 'DUPLICATE_EMAIL'
      });
    }
    
    res.status(500).json({ message: 'Failed to create user' });
  }
}

export async function getTotalUsers(req: Request, res: Response) {
  const log = getRequestLogger(req);
  try {
    const statusParam = req.query.status;
    const status: UserStatus | undefined =
      statusParam === 'active' || statusParam === 'inactive' ? statusParam : undefined;
    const total = await UsersModel.count({ status });
    res.json({ total });
  } catch (error) {
    log.error('users_total_count_failed', { error: String(error) });
    res.status(500).json({ message: 'Failed to get total users count' });
  }
}

export async function updateUserAccountType(req: Request, res: Response) {
  const log = getRequestLogger(req);
  try {
    const { gid } = req.params;
    const { account_type } = req.body;

    if (!account_type || !['user', 'service'].includes(account_type)) {
      return res.status(400).json({ message: 'Invalid account_type. Must be "user" or "service"' });
    }

    const success = await UsersModel.updateAccountType(parseInt(gid), account_type);
    if (!success) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User account type updated successfully' });
  } catch (error) {
    log.error('users_update_account_type_failed', { error: String(error) });
    res.status(500).json({ message: 'Failed to update user account type' });
  }
}

export async function deleteUser(req: Request, res: Response) {
  const log = getRequestLogger(req);
  try {
    const { gid } = req.params;
    const success = await UsersModel.delete(parseInt(gid));
    
    if (!success) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    log.error('users_delete_failed', { error: String(error) });
    res.status(500).json({ message: 'Failed to delete user' });
  }
}

export async function updateUserStatus(req: Request, res: Response) {
  const log = getRequestLogger(req);
  try {
    const gid = parseInt(req.params.gid, 10);
    if (!Number.isFinite(gid)) {
      return res.status(400).json({ message: 'Invalid gid' });
    }

    const { status } = req.body as { status?: string };
    if (status !== 'active' && status !== 'inactive') {
      return res.status(400).json({ message: 'status must be "active" or "inactive"' });
    }

    const user = await UsersModel.findByGid(gid);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const current: UserStatus = user.status === 'inactive' ? 'inactive' : 'active';
    if (current === status) {
      return res.json({ message: 'No change', user });
    }

    if (status === 'inactive') {
      const deviceIds = Array.isArray(user.device_id) ? [...user.device_id] : [];
      await UsersModel.setInactiveAndClearDevices(gid);
      const purgeJobsPushed = await enqueueDevicePurgeJobs([
        {
          deviceIds,
          userEmail: user.email,
          gid,
          source: 'manual_admin',
        },
      ]);
      log.info('users_manual_inactive', {
        gid,
        email: user.email,
        deviceCount: deviceIds.length,
        purgeJobsPushed,
      });
      return res.json({
        message: 'User marked inactive; devices cleared and purge jobs queued',
        purgeJobsPushed,
      });
    }

    await UsersModel.setActive(gid);
    log.info('users_manual_active', { gid, email: user.email });
    return res.json({ message: 'User marked active' });
  } catch (error) {
    log.error('users_update_status_failed', { error: String(error) });
    res.status(500).json({ message: 'Failed to update user status' });
  }
}

