import { Request, Response } from 'express';
import { UsersModel } from '../models/Users';

export async function getUsers(req: Request, res: Response) {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const pageSize = Math.max(1, Math.min(200, parseInt(String(req.query.pageSize || '50'), 10)));
  const search = String(req.query.search || '').trim();
  const enrollment = req.query.enrollment as 'enrolled' | 'un-enrolled' | undefined;
  const createdSortParam = req.query.createdSort;
  const createdSort = (createdSortParam === 'asc' || createdSortParam === 'desc') ? createdSortParam : null;
  const offset = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    UsersModel.list({ search, limit: pageSize, offset, enrollment, createdSort }),
    UsersModel.count({ search, enrollment }),
  ]);

  res.json({ items, total, page, pageSize });
}

export async function createUser(req: Request, res: Response) {
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
    console.error('Error creating user:', error);
    
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
  try {
    const total = await UsersModel.count();
    res.json({ total });
  } catch (error) {
    console.error('Error getting total users:', error);
    res.status(500).json({ message: 'Failed to get total users count' });
  }
}

export async function updateUserAccountType(req: Request, res: Response) {
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
    console.error('Error updating user account type:', error);
    res.status(500).json({ message: 'Failed to update user account type' });
  }
}

export async function deleteUser(req: Request, res: Response) {
  try {
    const { gid } = req.params;
    const success = await UsersModel.delete(parseInt(gid));
    
    if (!success) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
}


