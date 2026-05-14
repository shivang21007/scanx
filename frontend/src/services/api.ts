import axios, { AxiosInstance, AxiosResponse } from 'axios';
import Cookies from 'js-cookie';
import { LoginRequest, RegisterRequest, LoginResponse, RegisterResponse, Admin, ErrorResponse } from '../types/auth';
import { Device, DashboardStats, DeviceDetails, DevicesTableResponse, DevicesTableFilters } from '../types/device';
import { UsersResponse, TotalUsersResponse, UsersTableFilters } from '../types/user';

class ApiService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor() {
    // Dynamic API URL - uses current origin in development, env var in production
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const envApiUrl = import.meta.env.VITE_API_URL;
    
    // If VITE_API_URL is relative (starts with /), use current origin 
    if (envApiUrl && envApiUrl.startsWith('/')) {
      this.baseURL = `${currentOrigin}${envApiUrl}`;
    } else {
      // If absolute URL (http://your-domain.com) or fallback
      this.baseURL = envApiUrl || `${currentOrigin}/api`;
    }
    
    //console.log('API Service initialized with baseURL:', this.baseURL);
    
    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Include cookies in requests
    });

    // Handle response errors globally
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          //console.log('401 Unauthorized - clearing auth state');
          // Token expired or invalid, clear frontend state
          this.clearAuthCookie();
          this.removeStoredAdmin();
          // Only redirect if not already on auth pages
          if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
            //console.log('Redirecting to login due to auth failure');
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response: AxiosResponse<LoginResponse> = await this.api.post('/auth/login', credentials);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async register(userData: RegisterRequest): Promise<RegisterResponse> {
    try {
      const response: AxiosResponse<RegisterResponse> = await this.api.post('/auth/register', userData);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async getCurrentAdmin(): Promise<Admin> {
    try {
      //console.log('Making request to /auth/me...');
      const response: AxiosResponse<Admin> = await this.api.get('/auth/me');
      return response.data;
    } catch (error: any) {
      //console.log('getCurrentAdmin error:', error.response?.status, error.response?.data);
      throw this.handleError(error);
    }
  }

  async logout(): Promise<void> {
    try {
      await this.api.get('/auth/logout');
    } catch (error: any) {
      // Logout can fail silently as it's mostly client-side
      console.warn('Logout request failed:', error);
    } finally {
      // Always clear local storage
      localStorage.removeItem('scanx_token');
      localStorage.removeItem('scanx_admin');
    }
  }

  // Forgot password endpoints
  async forgotPasswordSendOTP(email: string): Promise<{ message: string; email: string }> {
    try {
      const response: AxiosResponse<{ message: string; email: string }> = await this.api.post('/auth/forgot-password/send-otp', { email });
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async forgotPasswordVerifyOTP(email: string, otp: string): Promise<{ message: string; email: string }> {
    try {
      const response: AxiosResponse<{ message: string; email: string }> = await this.api.post('/auth/forgot-password/verify-otp', { email, otp });
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async resetPassword(email: string, otp: string, newPassword: string): Promise<{ message: string }> {
    try {
      const response: AxiosResponse<{ message: string }> = await this.api.post('/auth/forgot-password/reset-password', { email, otp, newPassword });
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Error handler
  private handleError(error: any): Error {
    if (error.response?.data) {
      const errorData: ErrorResponse = error.response.data;
      return new Error(errorData.message || errorData.error || 'An error occurred');
    } else if (error.message) {
      return new Error(error.message);
    } else {
      return new Error('Network error occurred');
    }
  }

  // Cookie management (httpOnly cookies can't be read by JS, so we handle them server-side)
  clearAuthCookie(): void {
    // Try to clear the cookie on frontend (for non-httpOnly scenarios)
    Cookies.remove('scanx_token', { path: '/' });
    Cookies.remove('scanx_token', { path: '/', domain: 'localhost' });
    Cookies.remove('scanx_token'); // Default options
  }

  // Admin data management (keep in localStorage for UX)
  getStoredAdmin(): Admin | null {
    const adminData = localStorage.getItem('scanx_admin');
    return adminData ? JSON.parse(adminData) : null;
  }

  setStoredAdmin(admin: Admin): void {
    localStorage.setItem('scanx_admin', JSON.stringify(admin));
  }

  removeStoredAdmin(): void {
    localStorage.removeItem('scanx_admin');
  }

  // Device endpoints
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const response: AxiosResponse<DashboardStats> = await this.api.get('/devices/dashboard/stats');
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async getDevices(): Promise<Device[]> {
    try {
      const response: AxiosResponse<Device[]> = await this.api.get('/devices');
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async getDevicesTable(filters?: DevicesTableFilters): Promise<DevicesTableResponse> {
    try {
      const params = new URLSearchParams();
      if (filters?.search) {
        params.append('search', filters.search);
      }
      if (filters?.os_type) {
        params.append('os_type', filters.os_type);
      }
      if (filters?.sort_by) {
        params.append('sort_by', filters.sort_by);
      }
      if (filters?.sort_order) {
        params.append('sort_order', filters.sort_order);
      }
      if (filters?.password_manager) {
        params.append('password_manager', filters.password_manager);
      }
      if (filters?.disk_encryption) {
        params.append('disk_encryption', filters.disk_encryption);
      }
      if (filters?.antivirus) {
        params.append('antivirus', filters.antivirus);
      }
      if (filters?.screen_lock) {
        params.append('screen_lock', filters.screen_lock);
      }
      
      const url = `/devices/table${params.toString() ? `?${params.toString()}` : ''}`;
      //console.log('Fetching devices table data from:', url);
      
      const response: AxiosResponse<DevicesTableResponse> = await this.api.get(url);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async getDeviceById(id: number): Promise<DeviceDetails> {
    try {
      const response: AxiosResponse<DeviceDetails> = await this.api.get(`/devices/${id}`);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Get device data by type (latest only - used for apps_info)
  async getDeviceDataByType(deviceId: number, dataType: string): Promise<any> {
    try {
      const response: AxiosResponse<any> = await this.api.get(`/devices/${deviceId}/data/${dataType}`);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Get device data history (paginated - used for security tabs)
  async getDeviceDataHistory(
    deviceId: number, 
    dataType: string, 
    page: number = 1, 
    limit: number = 10
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const response: AxiosResponse<{
        data: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }> = await this.api.get(`/devices/${deviceId}/data/${dataType}/history`, {
        params: { page, limit }
      });
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Remove device by ID
  async deleteDeviceById(id: number): Promise<string> {
    try {
      const response: AxiosResponse<{ message: string }> = await this.api.delete(`/devices/${id}`);
      return response.data.message;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // User endpoints
  async getTotalUsers(status?: 'active' | 'inactive'): Promise<TotalUsersResponse> {
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const response: AxiosResponse<TotalUsersResponse> = await this.api.get(`/users/totalusers${qs}`);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async getUsers(filters?: UsersTableFilters): Promise<UsersResponse> {
    try {
      const params = new URLSearchParams();
      if (filters?.search) {
        params.append('search', filters.search);
      }
      if (filters?.page) {
        params.append('page', filters.page.toString());
      }
      if (filters?.pageSize) {
        params.append('pageSize', filters.pageSize.toString());
      }
      if (filters?.enrollment) {
        params.append('enrollment', filters.enrollment);
      }
      if (filters?.createdSort) {
        params.append('createdSort', filters.createdSort);
      }
      if (filters?.status) {
        params.append('status', filters.status);
      }
      if (filters?.account_type) {
        params.append('account_type', filters.account_type);
      }
      
      const url = `/users${params.toString() ? `?${params.toString()}` : ''}`;
      const response: AxiosResponse<UsersResponse> = await this.api.get(url);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async updateUserAccountType(gid: number, accountType: 'user' | 'service'): Promise<void> {
    try {
      await this.api.put(`/users/${gid}/account-type`, { account_type: accountType });
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async updateUserStatus(gid: number, status: 'active' | 'inactive'): Promise<void> {
    try {
      await this.api.patch(`/users/${gid}/status`, { status });
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async deleteUser(gid: number): Promise<void> {
    try {
      await this.api.delete(`/users/${gid}`);
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async createUser(name: string, email: string, accountType: 'user' | 'service'): Promise<void> {
    try {
      await this.api.post('/users', { name, email, account_type: accountType });
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Updates endpoints
  async getLatestVersions(): Promise<{ scanx: string; osqueryi: string }> {
    try {
      const response: AxiosResponse<{
        details: {
          scanx: { version: string };
          osqueryi: { version: string };
        };
      }> = await this.api.get('/updates/update-check');
      return {
        scanx: response.data.details.scanx.version,
        osqueryi: response.data.details.osqueryi.version,
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Interval update endpoints
  async requestIntervalChange(deviceId: number, interval: string): Promise<{
    message: string;
    request_id: number;
    device_id: number;
    requested_interval: string;
    status: string;
  }> {
    try {
      const response: AxiosResponse<{
        message: string;
        request_id: number;
        device_id: number;
        requested_interval: string;
        status: string;
      }> = await this.api.put(`/devices/${deviceId}/interval-request`, { interval });
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async getIntervalRequestHistory(
    deviceId: number, 
    page: number = 1, 
    limit: number = 10
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const response: AxiosResponse<{
        data: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }> = await this.api.get(`/devices/${deviceId}/interval-request/history`, {
        params: { page, limit }
      });
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async deleteIntervalRequest(requestId: number): Promise<void> {
    try {
      await this.api.delete(`/devices/interval-request/${requestId}`);
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

}

export const apiService = new ApiService();