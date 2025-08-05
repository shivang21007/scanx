import axios, { AxiosInstance, AxiosResponse } from 'axios';
import Cookies from 'js-cookie';
import { LoginRequest, RegisterRequest, LoginResponse, RegisterResponse, Admin, ErrorResponse } from '../types/auth';

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
          // Token expired or invalid, clear frontend cookies
          this.clearAuthCookie();
          this.removeStoredAdmin();
          window.location.href = '/login';
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
      const response: AxiosResponse<Admin> = await this.api.get('/api/auth/me');
      return response.data;
    } catch (error: any) {
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

  // Cookie management
  hasAuthCookie(): boolean {
    return !!Cookies.get('scanx_token');
  }

  clearAuthCookie(): void {
    Cookies.remove('scanx_token', { path: '/' });
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
}

export const apiService = new ApiService();