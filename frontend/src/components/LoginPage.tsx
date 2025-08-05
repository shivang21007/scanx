import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [shakeFields, setShakeFields] = useState({ email: false, password: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, isAuthenticated, loading, error, clearError } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Clear errors when user starts typing (but only if there are errors)
  useEffect(() => {
    if ((fieldErrors.email || fieldErrors.password) && (email || password)) {
      clearError();
      setFieldErrors({ email: '', password: '' });
      setShakeFields({ email: false, password: false });
    }
  }, [email, password, fieldErrors, clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      return;
    }

    console.log('Submitting login form...');
    
    // Clear previous errors
    setFieldErrors({ email: '', password: '' });
    setShakeFields({ email: false, password: false });
    setIsSubmitting(true);

    try {
      const success = await login(email, password);
      console.log('Login result:', success);
      
      if (success) {
        navigate('/dashboard');
      } else {
        // Login failed, error should be in context now
        console.log('Login failed, current error:', error);
      }
    } catch (err) {
      console.error('Login error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Watch for error changes from auth context
  useEffect(() => {
    console.log('Error state changed:', { error, loading, isSubmitting });
    
    if (error && !loading && !isSubmitting) {
      console.log('Displaying login error:', error);
      
      // Handle specific error types
      let emailError = '';
      let passwordError = '';
      let emailShake = false;
      let passwordShake = false;

      const errorMessage = error.toLowerCase();
      
      if (errorMessage.includes('invalid credentials') || errorMessage.includes('invalid') || errorMessage.includes('incorrect')) {
        emailError = 'Email or password is incorrect';
        passwordError = 'Email or password is incorrect';
        emailShake = true;
        passwordShake = true;
      } else if (errorMessage.includes('email') || errorMessage.includes('not found')) {
        emailError = 'Email not found';
        emailShake = true;
      } else if (errorMessage.includes('password')) {
        passwordError = 'Incorrect password';
        passwordShake = true;
      } else {
        // Default: show error on email field
        emailError = error;
        emailShake = true;
      }

      setFieldErrors({ email: emailError, password: passwordError });
      setShakeFields({ email: emailShake, password: passwordShake });

      // Remove shake effect after animation
      setTimeout(() => {
        setShakeFields({ email: false, password: false });
      }, 600);
    }
  }, [error, loading, isSubmitting]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Login Form */}
        <div className="bg-white p-8">
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center mb-6">
              <img 
                src="/favicon.ico" 
                alt="ScanX Logo" 
                className="w-8 h-8"
              />
            </div>
            <h1 className="text-lg font-medium text-gray-900 mb-6">ScanX</h1>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h2>
            <p className="text-gray-600">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm text-gray-600 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full pb-2 border-0 border-b bg-transparent focus:outline-none text-gray-900 placeholder-gray-400 transition-all duration-200 ${
                  fieldErrors.email 
                    ? 'border-red-500 focus:border-red-500' 
                    : 'border-gray-300 focus:border-blue-500'
                } ${shakeFields.email ? 'animate-shake' : ''}`}
                placeholder="you@example.com"
                required
                disabled={loading}
              />
              {fieldErrors.email && (
                <p className="text-red-500 text-xs mt-1 animate-fade-in">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm text-gray-600 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full pb-2 pr-8 border-0 border-b bg-transparent focus:outline-none text-gray-900 placeholder-gray-400 transition-all duration-200 ${
                    fieldErrors.password 
                      ? 'border-red-500 focus:border-red-500' 
                      : 'border-gray-300 focus:border-blue-500'
                  } ${shakeFields.password ? 'animate-shake' : ''}`}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-0 bottom-2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-red-500 text-xs mt-1 animate-fade-in">{fieldErrors.password}</p>
              )}
            </div>



            {/* Forgot Password */}
            <div className="text-right">
              <a href="#" className="text-sm text-blue-600 hover:text-blue-500 underline">
                Forgot password?
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || isSubmitting || !email || !password}
              className="w-full mt-6 py-3 px-4 bg-gray-900 text-white rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {(loading || isSubmitting) ? (
                <div className="flex items-center justify-center">
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Signing in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>

            {/* Register Link */}
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <Link to="/register" className="text-blue-600 hover:text-blue-500 font-medium underline">
                  Sign up
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}