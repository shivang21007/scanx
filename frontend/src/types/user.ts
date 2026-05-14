export interface User {
  gid: number;
  email: string;
  name: string;
  created_at: string;
  account_type: 'user' | 'service';
  status: 'active' | 'inactive';
  device_id?: number[] | null;
  updated_at: string;
}

export interface UsersResponse {
  items: User[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TotalUsersResponse {
  total: number;
}

export interface UsersTableFilters {
  search?: string;
  page?: number;
  pageSize?: number;
  enrollment?: 'enrolled' | 'un-enrolled';
  status?: 'active' | 'inactive';
  /** Match query param `account_type` */
  account_type?: 'user' | 'service';
  createdSort?: 'asc' | 'desc' | null;
}
