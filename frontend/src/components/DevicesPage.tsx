import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useSearchParams } from 'react-router-dom';
import { LogOut, Search, Filter, Monitor, ChevronLeft, X } from 'lucide-react';
import { apiService } from '../services/api';
import { DevicesTableResponse, DevicesTableFilters } from '../types/device';
import { LoadingSpinner } from './LoadingSpinner';
import { DevicesTable } from './DevicesTable';

export function DevicesPage() {
  const { admin, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const [devicesData, setDevicesData] = useState<DevicesTableResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize search from URL query parameter if present
  const initialSearch = searchParams.get('search') || '';
  const [filters, setFilters] = useState<DevicesTableFilters>({
    search: initialSearch,
    os_type: ''
  });

  // Debounced search state - initialize from URL
  const [searchInput, setSearchInput] = useState(initialSearch);

  // OS version sort state: null = no sort, 'asc' = ascending, 'desc' = descending
  const [osVersionSort, setOsVersionSort] = useState<'asc' | 'desc' | null>(null);

  // Security filter states: null = no filter, 'false' = show false (red), 'true' = show true (green)
  const [passwordManagerFilter, setPasswordManagerFilter] = useState<'true' | 'false' | null>(null);
  const [diskEncryptionFilter, setDiskEncryptionFilter] = useState<'true' | 'false' | null>(null);
  const [antivirusFilter, setAntivirusFilter] = useState<'true' | 'false' | null>(null);
  const [screenLockFilter, setScreenLockFilter] = useState<'true' | 'false' | null>(null);

  // Last Check sort state: 'desc' = latest first (default), 'asc' = oldest first
  const [lastCheckSort, setLastCheckSort] = useState<'asc' | 'desc'>('desc');

  // Latest versions state
  const [latestVersions, setLatestVersions] = useState<{
    scanx: string | null;
    osqueryi: string | null;
    scanxError: boolean;
    osqueryiError: boolean;
  }>({
    scanx: null,
    osqueryi: null,
    scanxError: false,
    osqueryiError: false,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput }));
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchDevicesData();

    // Auto-refresh every 5 minutes (300000ms)
    const refreshInterval = setInterval(() => {
      //console.log('Auto-refreshing devices data...');
      fetchDevicesData();
    }, 300000);

    // Cleanup interval on unmount or filter change
    return () => clearInterval(refreshInterval);
  }, [filters, osVersionSort, passwordManagerFilter, diskEncryptionFilter, antivirusFilter, screenLockFilter, lastCheckSort]);

  // Fetch latest versions on mount
  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const versions = await apiService.getLatestVersions();
        setLatestVersions({
          scanx: versions.scanx,
          osqueryi: versions.osqueryi,
          scanxError: false,
          osqueryiError: false,
        });
      } catch (error) {
        // Handle errors gracefully - set error flags but don't crash
        console.warn('Failed to fetch latest versions:', error);
        setLatestVersions(prev => ({
          ...prev,
          scanxError: true,
          osqueryiError: true,
        }));
      }
    };

    fetchVersions();
  }, []);

  const fetchDevicesData = async () => {
    try {
      setLoading(true);
      setError(null);
      //console.log('Fetching devices with filters:', filters);
      
      // Build filters with sort and security filter parameters
      const filtersWithSort: DevicesTableFilters = {
        ...filters,
        ...(osVersionSort ? { sort_by: 'os_version', sort_order: osVersionSort } : {}),
        // Last Check sort takes precedence if OS version sort is not active
        ...(!osVersionSort && lastCheckSort ? { sort_by: 'last_seen', sort_order: lastCheckSort } : {}),
        ...(passwordManagerFilter ? { password_manager: passwordManagerFilter } : {}),
        ...(diskEncryptionFilter ? { disk_encryption: diskEncryptionFilter } : {}),
        ...(antivirusFilter ? { antivirus: antivirusFilter } : {}),
        ...(screenLockFilter ? { screen_lock: screenLockFilter } : {})
      };
      
      const data = await apiService.getDevicesTable(filtersWithSort);
      setDevicesData(data);
      //console.log('Devices data loaded:', data);
    } catch (err: any) {
      console.error('Failed to fetch devices data:', err);
      setError(err.message || 'Failed to load devices data');
    } finally {
      setLoading(false);
    }
  };

  const handleOsVersionSort = () => {
    // Cycle through: null -> 'asc' -> 'desc' -> null
    if (osVersionSort === null) {
      setOsVersionSort('asc');
    } else if (osVersionSort === 'asc') {
      setOsVersionSort('desc');
    } else {
      setOsVersionSort(null);
    }
  };

  const handleSecurityFilter = (
    filterType: 'password_manager' | 'disk_encryption' | 'antivirus' | 'screen_lock'
  ) => {
    const setters = {
      password_manager: setPasswordManagerFilter,
      disk_encryption: setDiskEncryptionFilter,
      antivirus: setAntivirusFilter,
      screen_lock: setScreenLockFilter
    };
    
    const getters = {
      password_manager: passwordManagerFilter,
      disk_encryption: diskEncryptionFilter,
      antivirus: antivirusFilter,
      screen_lock: screenLockFilter
    };

    const currentValue = getters[filterType];
    const setter = setters[filterType];

    // Cycle through: null -> 'false' -> 'true' -> null
    if (currentValue === null) {
      setter('false');
    } else if (currentValue === 'false') {
      setter('true');
    } else {
      setter(null);
    }
  };

  const handleLastCheckSort = () => {
    // Toggle between 'desc' (latest first) and 'asc' (oldest first)
    setLastCheckSort(prev => prev === 'desc' ? 'asc' : 'desc');
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
          {/* Desktop Layout */}
          <div className="hidden sm:flex items-center h-16">
            {/* Left side - Navigation */}
            <div className="flex items-center space-x-4 flex-shrink-0">
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

            {/* Center - Latest Versions */}
            <div className="flex-1 flex justify-center items-center">
              <div className="flex items-center space-x-3 text-sm">
                <div className="flex items-center space-x-1">
                  <span className="text-gray-500">ScanX:</span>
                  {latestVersions.scanxError ? (
                    <span className="text-red-500 text-xs">Error</span>
                  ) : latestVersions.scanx ? (
                    <span className="text-gray-900 font-medium">{latestVersions.scanx}</span>
                  ) : (
                    <span className="text-gray-400">Loading...</span>
                  )}
                </div>
                <div className="h-4 w-px bg-gray-300"></div>
                <div className="flex items-center space-x-1">
                  <span className="text-gray-500">Osqueryi:</span>
                  {latestVersions.osqueryiError ? (
                    <span className="text-red-500 text-xs">Error</span>
                  ) : latestVersions.osqueryi ? (
                    <span className="text-gray-900 font-medium">{latestVersions.osqueryi}</span>
                  ) : (
                    <span className="text-gray-400">Loading...</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right side - User menu */}
            <div className="flex items-center space-x-4 flex-shrink-0">
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

          {/* Mobile Layout */}
          <div className="sm:hidden py-3 space-y-2">
            {/* Row 1: Navigation + Sign out icon */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Link 
                  to="/dashboard"
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Dashboard</span>
                </Link>
                <div className="h-4 w-px bg-gray-300"></div>
                <div className="flex items-center">
                  <Monitor className="h-4 w-4 text-blue-600 mr-1" />
                  <h1 className="text-base font-semibold text-gray-900">Devices</h1>
                </div>
              </div>
              <button
                onClick={logout}
                className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>

            {/* Row 2: Versions (left) + Username (right) */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  <span className="text-gray-500">ScanX:</span>
                  {latestVersions.scanxError ? (
                    <span className="text-red-500">Error</span>
                  ) : latestVersions.scanx ? (
                    <span className="text-gray-900 font-medium">{latestVersions.scanx}</span>
                  ) : (
                    <span className="text-gray-400">Loading...</span>
                  )}
                </div>
                <div className="h-3 w-px bg-gray-300"></div>
                <div className="flex items-center space-x-1">
                  <span className="text-gray-500">Osqueryi:</span>
                  {latestVersions.osqueryiError ? (
                    <span className="text-red-500">Error</span>
                  ) : latestVersions.osqueryi ? (
                    <span className="text-gray-900 font-medium">{latestVersions.osqueryi}</span>
                  ) : (
                    <span className="text-gray-400">Loading...</span>
                  )}
                </div>
              </div>
              <span className="text-gray-900 font-medium truncate ml-2">
                {admin?.name || admin?.email}
              </span>
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
                  placeholder="Search by serial number, email, os version or computer name..."
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
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {devicesData ? (
                  <>
                    <span className="text-gray-600">
                      Showing <span className="font-medium">{devicesData.devices.length}</span> of{' '}
                      <span className="font-medium">{devicesData.total}</span> devices
                    </span>
                    
                    {/* Search Filter */}
                    {filters.search && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md">
                        <span className="text-blue-700 text-sm">
                          Search: "{filters.search}"
                        </span>
                        <button
                          onClick={() => setSearchInput('')}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded p-0.5 transition-colors"
                          title="Clear search"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    
                    {/* OS Type Filter */}
                    {filters.os_type && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-md">
                        <span className="text-blue-700 text-sm">
                          OS: {filters.os_type === 'darwin' ? 'macOS' : filters.os_type}
                        </span>
                        <button
                          onClick={() => setFilters(prev => ({ ...prev, os_type: '' }))}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded p-0.5 transition-colors"
                          title="Clear OS type filter"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    
                    {/* OS Version Sort */}
                    {osVersionSort && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-md">
                        <span className="text-purple-700 text-sm">
                          Sort: OS Version ({osVersionSort === 'asc' ? 'Ascending' : 'Descending'})
                        </span>
                        <button
                          onClick={() => setOsVersionSort(null)}
                          className="text-purple-600 hover:text-purple-800 hover:bg-purple-100 rounded p-0.5 transition-colors"
                          title="Clear OS version sort"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    
                    {/* Last Check Sort */}
                    {lastCheckSort === 'asc' && !osVersionSort && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-md">
                        <span className="text-purple-700 text-sm">
                          Sort: Last Check (Oldest First)
                        </span>
                        <button
                          onClick={() => setLastCheckSort('desc')}
                          className="text-purple-600 hover:text-purple-800 hover:bg-purple-100 rounded p-0.5 transition-colors"
                          title="Reset to default sort"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    
                    {/* Security Filters */}
                    {passwordManagerFilter && (
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-md ${
                        passwordManagerFilter === 'false' 
                          ? 'bg-red-50 border-red-200' 
                          : 'bg-green-50 border-green-200'
                      }`}>
                        <span className={`text-sm ${
                          passwordManagerFilter === 'false' ? 'text-red-700' : 'text-green-700'
                        }`}>
                          PW: {passwordManagerFilter === 'false' ? 'Disabled' : 'Enabled'}
                        </span>
                        <button
                          onClick={() => setPasswordManagerFilter(null)}
                          className={`hover:bg-opacity-20 rounded p-0.5 transition-colors ${
                            passwordManagerFilter === 'false' 
                              ? 'text-red-600 hover:bg-red-100' 
                              : 'text-green-600 hover:bg-green-100'
                          }`}
                          title="Clear password manager filter"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    
                    {diskEncryptionFilter && (
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-md ${
                        diskEncryptionFilter === 'false' 
                          ? 'bg-red-50 border-red-200' 
                          : 'bg-green-50 border-green-200'
                      }`}>
                        <span className={`text-sm ${
                          diskEncryptionFilter === 'false' ? 'text-red-700' : 'text-green-700'
                        }`}>
                          HD: {diskEncryptionFilter === 'false' ? 'Disabled' : 'Enabled'}
                        </span>
                        <button
                          onClick={() => setDiskEncryptionFilter(null)}
                          className={`hover:bg-opacity-20 rounded p-0.5 transition-colors ${
                            diskEncryptionFilter === 'false' 
                              ? 'text-red-600 hover:bg-red-100' 
                              : 'text-green-600 hover:bg-green-100'
                          }`}
                          title="Clear disk encryption filter"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    
                    {antivirusFilter && (
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-md ${
                        antivirusFilter === 'false' 
                          ? 'bg-red-50 border-red-200' 
                          : 'bg-green-50 border-green-200'
                      }`}>
                        <span className={`text-sm ${
                          antivirusFilter === 'false' ? 'text-red-700' : 'text-green-700'
                        }`}>
                          AV: {antivirusFilter === 'false' ? 'Disabled' : 'Enabled'}
                        </span>
                        <button
                          onClick={() => setAntivirusFilter(null)}
                          className={`hover:bg-opacity-20 rounded p-0.5 transition-colors ${
                            antivirusFilter === 'false' 
                              ? 'text-red-600 hover:bg-red-100' 
                              : 'text-green-600 hover:bg-green-100'
                          }`}
                          title="Clear antivirus filter"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    
                    {screenLockFilter && (
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-md ${
                        screenLockFilter === 'false' 
                          ? 'bg-red-50 border-red-200' 
                          : 'bg-green-50 border-green-200'
                      }`}>
                        <span className={`text-sm ${
                          screenLockFilter === 'false' ? 'text-red-700' : 'text-green-700'
                        }`}>
                          SL: {screenLockFilter === 'false' ? 'Disabled' : 'Enabled'}
                        </span>
                        <button
                          onClick={() => setScreenLockFilter(null)}
                          className={`hover:bg-opacity-20 rounded p-0.5 transition-colors ${
                            screenLockFilter === 'false' 
                              ? 'text-red-600 hover:bg-red-100' 
                              : 'text-green-600 hover:bg-green-100'
                          }`}
                          title="Clear screen lock filter"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-gray-600">Loading devices...</span>
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
            osVersionSort={osVersionSort}
            onOsVersionSort={handleOsVersionSort}
            passwordManagerFilter={passwordManagerFilter}
            diskEncryptionFilter={diskEncryptionFilter}
            antivirusFilter={antivirusFilter}
            screenLockFilter={screenLockFilter}
            onSecurityFilter={handleSecurityFilter}
            lastCheckSort={lastCheckSort}
            onLastCheckSort={handleLastCheckSort}
            onDeviceDeleted={async () => {
              await fetchDevicesData();
              return true;
            }}
          />
        )}
      </main>
    </div>
  );
}