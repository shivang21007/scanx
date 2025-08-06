import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { LogOut, Search, Filter, Monitor, ChevronLeft } from 'lucide-react';
import { apiService } from '../services/api';
import { DevicesTableResponse, DevicesTableFilters } from '../types/device';
import { LoadingSpinner } from './LoadingSpinner';
import { DevicesTable } from './DevicesTable';

export function DevicesPage() {
  const { admin, logout } = useAuth();
  const [devicesData, setDevicesData] = useState<DevicesTableResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DevicesTableFilters>({
    search: '',
    os_type: ''
  });

  // Debounced search state
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput }));
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchDevicesData();
  }, [filters]);

  const fetchDevicesData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching devices with filters:', filters);
      
      const data = await apiService.getDevicesTable(filters);
      setDevicesData(data);
      console.log('Devices data loaded:', data);
    } catch (err: any) {
      console.error('Failed to fetch devices data:', err);
      setError(err.message || 'Failed to load devices data');
    } finally {
      setLoading(false);
    }
  };

  const handleOsTypeFilter = (osType: string) => {
    setFilters(prev => ({ 
      ...prev, 
      os_type: prev.os_type === osType ? '' : osType 
    }));
  };

  if (loading && !devicesData) {
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
          <div className="text-red-600 text-xl mb-4">Error Loading Devices</div>
          <div className="text-gray-600 mb-4">{error}</div>
          <button 
            onClick={fetchDevicesData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
                <Monitor className="h-5 w-5 text-blue-600 mr-2" />
                <h1 className="text-xl font-semibold text-gray-900">Devices</h1>
              </div>
            </div>

            {/* Right side - User menu */}
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {admin?.name || admin?.email}
              </span>
              <button
                onClick={logout}
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
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            {/* Search Bar */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by computer name, serial number, or email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* OS Type Filters */}
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600 mr-2">OS Type:</span>
              <div className="flex space-x-2">
                {['darwin', 'windows', 'linux'].map((osType) => (
                  <button
                    key={osType}
                    onClick={() => handleOsTypeFilter(osType)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      filters.os_type === osType
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {osType === 'darwin' ? 'macOS' : osType.charAt(0).toUpperCase() + osType.slice(1)}
                  </button>
                ))}
                {filters.os_type && (
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, os_type: '' }))}
                    className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Results Summary */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {devicesData ? (
                  <>
                    Showing <span className="font-medium">{devicesData.devices.length}</span> of{' '}
                    <span className="font-medium">{devicesData.total}</span> devices
                    {filters.search && (
                      <span> matching "{filters.search}"</span>
                    )}
                    {filters.os_type && (
                      <span> on {filters.os_type === 'darwin' ? 'macOS' : filters.os_type}</span>
                    )}
                  </>
                ) : (
                  'Loading devices...'
                )}
              </div>
              {loading && (
                <div className="flex items-center text-sm text-gray-500">
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Updating...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Devices Table */}
        {devicesData && (
          <DevicesTable 
            devices={devicesData.devices}
            loading={loading}
          />
        )}
      </main>
    </div>
  );
}