// Auth-related TypeScript interfaces

export interface Admin {
  id: number;
  email: string;
  name?: string;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginResponse {
  message: string;
  admin: Admin;
}

export interface RegisterResponse {
  message: string;
  admin: Admin;
}

export interface ErrorResponse {
  message: string;
  error?: string;
  logout?: boolean;
  expired?: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  admin: Admin | null;
  loading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}