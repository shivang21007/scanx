import { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import { AuthState, AuthContextType, Admin } from '../types/auth';
import { apiService } from '../services/api';

// Auth actions
type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { admin: Admin } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'REGISTER_START' }
  | { type: 'REGISTER_SUCCESS'; payload: { admin: Admin } }
  | { type: 'REGISTER_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'CHECK_AUTH_START' }
  | { type: 'CHECK_AUTH_SUCCESS'; payload: Admin }
  | { type: 'CHECK_AUTH_FAILURE' };

// Initial state
const initialState: AuthState = {
  isAuthenticated: false,
  admin: null,
  loading: true, // Start with loading true to check stored auth
  error: null,
};

// Auth reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_START':
    case 'REGISTER_START':
    case 'CHECK_AUTH_START':
      return {
        ...state,
        loading: true,
        error: null,
      };

    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        admin: action.payload.admin,
        loading: false,
        error: null,
      };

    case 'REGISTER_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        admin: action.payload.admin,
        loading: false,
        error: null,
      };

    case 'LOGIN_FAILURE':
    case 'REGISTER_FAILURE':
      return {
        ...state,
        isAuthenticated: false,
        admin: null,
        loading: false,
        error: action.payload,
      };

    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        admin: null,
        loading: false,
        error: null,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
      };

    case 'CHECK_AUTH_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        admin: action.payload,
        loading: false,
        error: null,
      };

    case 'CHECK_AUTH_FAILURE':
      return {
        ...state,
        isAuthenticated: false,
        admin: null,
        loading: false,
        error: null,
      };

    default:
      return state;
  }
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const checkAuth = useCallback(async (): Promise<void> => {
    try {
      dispatch({ type: 'CHECK_AUTH_START' });
      
      // Check if auth cookie exists first
      if (!apiService.hasAuthCookie()) {
        dispatch({ type: 'CHECK_AUTH_FAILURE' });
        return;
      }

      // Try stored admin data first for faster UX
      const storedAdmin = apiService.getStoredAdmin();
      if (storedAdmin) {
        dispatch({ type: 'CHECK_AUTH_SUCCESS', payload: storedAdmin });
        return;
      }
      
      // If no stored data, verify with server
      const admin = await apiService.getCurrentAdmin();
      apiService.setStoredAdmin(admin);
      dispatch({ type: 'CHECK_AUTH_SUCCESS', payload: admin });
    } catch (error) {
      // Clear everything on auth failure
      apiService.clearAuthCookie();
      apiService.removeStoredAdmin();
      dispatch({ type: 'CHECK_AUTH_FAILURE' });
    }
  }, []);

  // Check for existing auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      dispatch({ type: 'LOGIN_START' });
      
      const response = await apiService.login({ email, password });
      
      // Store admin data (token is now in httpOnly cookie)
      apiService.setStoredAdmin(response.admin);
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          admin: response.admin,
        },
      });
      
      return true;
    } catch (error: any) {
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: error.message || 'Login failed',
      });
      return false;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string): Promise<boolean> => {
    try {
      dispatch({ type: 'REGISTER_START' });
      
      const response = await apiService.register({ email, password, name });
      
      // Store admin data (token is now in httpOnly cookie)
      apiService.setStoredAdmin(response.admin);
      
      dispatch({
        type: 'REGISTER_SUCCESS',
        payload: {
          admin: response.admin,
        },
      });
      return true;
    } catch (error: any) {
      dispatch({
        type: 'REGISTER_FAILURE',
        payload: error.message || 'Registration failed',
      });
      return false;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      // Call backend logout (optional, for server-side cleanup)
      await apiService.logout();
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      // Clear frontend cookies and data
      apiService.clearAuthCookie();
      apiService.removeStoredAdmin();
      dispatch({ type: 'LOGOUT' });
    }
  }, []);

  const clearError = useCallback((): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const contextValue: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    clearError,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}