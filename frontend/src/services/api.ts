import axios, { AxiosInstance, AxiosResponse } from 'axios';
import Cookies from 'js-cookie';
import { LoginRequest, RegisterRequest, LoginResponse, RegisterResponse, Admin, ErrorResponse } from '../types/auth';
import { Device, DashboardStats, DeviceDetails, DevicesTableResponse, DevicesTableFilters } from '../types/device';

class ApiService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    
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
          console.log('401 Unauthorized - clearing auth state');
          // Token expired or invalid, clear frontend state
          this.clearAuthCookie();
          this.removeStoredAdmin();
          // Only redirect if not already on auth pages
          if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
            console.log('Redirecting to login due to auth failure');
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
      const response: AxiosResponse<LoginResponse> = await this.api.post('/api/auth/login', credentials);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async register(userData: RegisterRequest): Promise<RegisterResponse> {
    try {
      const response: AxiosResponse<RegisterResponse> = await this.api.post('/api/auth/register', userData);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async getCurrentAdmin(): Promise<Admin> {
    try {
      console.log('Making request to /api/auth/me...');
      const response: AxiosResponse<Admin> = await this.api.get('/api/auth/me');
      console.log('Current admin response:', response.data);
      return response.data;
    } catch (error: any) {
      console.log('getCurrentAdmin error:', error.response?.status, error.response?.data);
      throw this.handleError(error);
    }
  }

  async logout(): Promise<void> {
    try {
      await this.api.get('/api/auth/logout');
    } catch (error: any) {
      // Logout can fail silently as it's mostly client-side
      console.warn('Logout request failed:', error);
    } finally {
      // Always clear local storage
      localStorage.removeItem('scanx_token');
      localStorage.removeItem('scanx_admin');
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
      const response: AxiosResponse<DashboardStats> = await this.api.get('/api/devices/dashboard/stats');
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async getDevices(): Promise<Device[]> {
    try {
      const response: AxiosResponse<Device[]> = await this.api.get('/api/devices');
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
      
      const url = `/api/devices/table${params.toString() ? `?${params.toString()}` : ''}`;
      console.log('Fetching devices table data from:', url);
      
      const response: AxiosResponse<DevicesTableResponse> = await this.api.get(url);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async getDeviceById(id: number): Promise<DeviceDetails> {
    try {
      const response: AxiosResponse<DeviceDetails> = await this.api.get(`/api/devices/${id}`);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }


}

export const apiService = new ApiService();