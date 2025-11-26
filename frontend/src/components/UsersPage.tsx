import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Users, Search, LogOut, X } from 'lucide-react';
import { apiService } from '../services/api';
import { User, UsersTableFilters } from '../types/user';
import { LoadingSpinner } from './LoadingSpinner';
import { UsersTable } from './UsersTable';
import { useAuth } from '../contexts/AuthContext';
import toast, { Toaster } from 'react-hot-toast';

export function UsersPage() {
  const { admin, logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createUserDialog, setCreateUserDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<UsersTableFilters>({
    page: 1,
    pageSize: 10
  });
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    accountType: 'user' as 'user' | 'service'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiService.getUsers(filters);
        setUsers(response.items);
        setTotalUsers(response.total);
        setCurrentPage(response.page);
        setPageSize(response.pageSize);
      } catch (err: any) {
        setError(err.message || 'Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    const handler = setTimeout(() => {
      fetchUsers();
    }, 500); // Debounce search

    // Auto-refresh every 1 minutes (60000ms)
    const refreshInterval = setInterval(() => {
      console.log('Auto-refreshing users data...');
      fetchUsers();
    }, 60000);

    return () => {
      clearTimeout(handler);
      clearInterval(refreshInterval);
    };
  }, [filters]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setFilters(prev => ({ ...prev, pageSize: newPageSize, page: 1 }));
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilters({ page: 1, pageSize: 10 });
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.createUser(formData.name, formData.email, formData.accountType);
      toast.success('User created successfully!');
      
      // Reset form and close dialog
      setFormData({ name: '', email: '', accountType: 'user' });
      setCreateUserDialog(false);
      
      // Refresh users list
      const response = await apiService.getUsers(filters);
      setUsers(response.items);
      setTotalUsers(response.total);
    } catch (err: any) {
      console.error('Failed to create user:', err);
      toast.error(err.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !users.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side - Navigation */}
            <div className="flex items-center space-x-4">
              <Link 
                to="/dashboard"
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ChevronLeft className="h-5 w-5 mr-1" />
                Dashboard
              </Link>
              <div className="h-5 w-px bg-gray-300"></div>
              <div className="flex items-center">
                <Users className="h-5 w-5 text-purple-600 mr-2" />
                <h1 className="text-xl font-semibold text-gray-900">Users</h1>
              </div>
            </div>

            {/* Right side - User menu */}
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {admin?.name || admin?.email}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 sm:px-6 lg:px-12 xl:px-16 py-8">
        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Search left side of the page */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by email or name..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
            {/* Add User right side of the page */}
            <button
              onClick={() => {
                setCreateUserDialog(!createUserDialog);
                if (!createUserDialog) {
                  setFormData({ name: '', email: '', accountType: 'user' });
                }
              }}
              disabled={submitting}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 hover:scale-105 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {createUserDialog ? 'Close' : 'Create User'}
            </button>

            {/* Clear Filters */}
            {(searchTerm) && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Create User Form */}
        {createUserDialog && (
          <div className="mb-6 bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Create New User</h2>
              <button
                onClick={() => setCreateUserDialog(false)}
                disabled={submitting}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              {/* Name Input */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="John Doe"
                  required
                  disabled={submitting}
                />
              </div>

              {/* Email Input */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="john@example.com"
                  required
                  disabled={submitting}
                />
              </div>

              {/* Account Type Radio Buttons */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Type
                </label>
                <div className="flex items-center space-x-4 h-10">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="account_type"
                      value="user"
                      checked={formData.accountType === 'user'}
                      onChange={(e) => setFormData({ ...formData, accountType: e.target.value as 'user' | 'service' })}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                      disabled={submitting}
                    />
                    <span className="ml-2 text-sm text-gray-700">User</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="account_type"
                      value="service"
                      checked={formData.accountType === 'service'}
                      onChange={(e) => setFormData({ ...formData, accountType: e.target.value as 'user' | 'service' })}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                      disabled={submitting}
                    />
                    <span className="ml-2 text-sm text-gray-700">Service</span>
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 hover:scale-105 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {submitting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                )}
                {submitting ? 'Creating...' : 'Create User'}
              </button>
            </form>
          </div>
        )}

        {/* Users Table */}
        <UsersTable 
          users={users} 
          loading={loading}
          onUpdateAccountType={async (gid, accountType) => {
            try {
              await apiService.updateUserAccountType(gid, accountType);
              toast.success('Account type updated successfully!');
              // Refresh the data
              const response = await apiService.getUsers(filters);
              setUsers(response.items);
            } catch (err: any) {
              console.error('Failed to update user account type:', err);
              toast.error(err.message || 'Failed to update account type');
            }
          }}
          onDeleteUser={async (gid) => {
            try {
              await apiService.deleteUser(gid);
              toast.success('User deleted successfully!');
              // Refresh the data
              const response = await apiService.getUsers(filters);
              setUsers(response.items);
              setTotalUsers(response.total);
            } catch (err: any) {
              console.error('Failed to delete user:', err);
              toast.error(err.message || 'Failed to delete user');
            }
          }}
        />

        {/* Pagination */}
        {!loading && totalUsers > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Page Info */}
              <div className="text-sm text-gray-700">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalUsers)} of {totalUsers} users
              </div>

              {/* Page Size Selector */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-sm text-gray-700">per page</span>
              </div>

              {/* Page Navigation */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {Math.ceil(totalUsers / pageSize)}
                </span>
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= Math.ceil(totalUsers / pageSize)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
