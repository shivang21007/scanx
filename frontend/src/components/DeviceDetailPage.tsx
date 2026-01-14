import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Monitor, ChevronLeft, Shield, Settings, Grid3X3, HardDrive, Lock, Eye, AlertTriangle, ChevronDown } from 'lucide-react';
import { apiService } from '../services/api';

import { LoadingSpinner } from './LoadingSpinner';
import { formatAbsolute, getDeviceStatus } from '../utils/timezone';

// Types for tab data
interface TabDataState {
  data: any;
  loading: boolean;
  error: string | null;
  loaded: boolean;
  // For paginated data
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

// History data types that support pagination
const HISTORY_TABS = ['disk_encryption_info', 'password_manager_info', 'antivirus_info', 'screen_lock_info'];
// Apps only needs latest data
const LATEST_ONLY_TABS = ['apps_info'];

export function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { admin, logout } = useAuth();
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Per-tab data state (lazy loaded)
  const [tabData, setTabData] = useState<Record<string, TabDataState>>({});
  // Ref to track current tabData for sync access in callbacks
  const tabDataRef = useRef<Record<string, TabDataState>>({});
  // Pagination limit selector
  const [historyLimit, setHistoryLimit] = useState(10);

  const deviceId = parseInt(id || '0');
  
  // Keep ref in sync with state
  useEffect(() => {
    tabDataRef.current = tabData;
  }, [tabData]);

  // Fetch tab data on demand
  const fetchTabData = useCallback(async (tabId: string, page: number = 1, limit: number = 10, forceRefresh: boolean = false) => {
    if (!deviceId) return;
    
    // Check current state via ref (synchronous access)
    const existing = tabDataRef.current[tabId];
    
    // Skip if already loaded (for non-paginated requests) and not forcing refresh
    if (!forceRefresh && existing?.loaded) {
      if (!HISTORY_TABS.includes(tabId)) {
        return; // Apps data already loaded, skip
      }
      // For history tabs, skip if same limit and same page
      if (existing.limit === limit && existing.page === page) {
        return;
      }
    }
    
    // Set loading state
    setTabData(prev => ({
      ...prev,
      [tabId]: { 
        ...prev[tabId], 
        loading: true, 
        error: null 
      }
    }));
    
    try {
      if (HISTORY_TABS.includes(tabId)) {
        // Fetch paginated history
        const historyResult = await apiService.getDeviceDataHistory(deviceId, tabId, page, limit);
        setTabData(prev => ({
          ...prev,
          [tabId]: {
            data: historyResult.data,
            loading: false,
            error: null,
            loaded: true,
            page: historyResult.page,
            limit: historyResult.limit,
            total: historyResult.total,
            totalPages: historyResult.totalPages
          }
        }));
      } else if (LATEST_ONLY_TABS.includes(tabId)) {
        // Fetch latest only (for apps)
        const latestResult = await apiService.getDeviceDataByType(deviceId, tabId);
        setTabData(prev => ({
          ...prev,
          [tabId]: {
            data: latestResult,
            loading: false,
            error: null,
            loaded: true
          }
        }));
      }
    } catch (err: any) {
      console.error(`Failed to fetch ${tabId}:`, err);
      setTabData(prev => ({
        ...prev,
        [tabId]: {
          ...prev[tabId],
          loading: false,
          error: err.message || `Failed to load ${tabId}`,
          loaded: true
        }
      }));
    }
  }, [deviceId]);

  // Fetch device overview (device + summary + system_info) on mount
  useEffect(() => {
    if (!deviceId) {
      setError('Invalid device ID');
      setLoading(false);
      return;
    }

    const fetchDeviceDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        // Lightweight API call - only device, summary, and system_info
        const response = await apiService.getDeviceById(deviceId);
        setDeviceInfo(response);
      } catch (err: any) {
        console.error('Failed to fetch device details:', err);
        setError(err.message || 'Failed to load device details');
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchDeviceDetails();

    // Auto-refresh every 5 minutes (300000ms)
    const refreshInterval = setInterval(() => {
      fetchDeviceDetails();
    }, 300000);

    // Cleanup interval on unmount or device ID change
    return () => clearInterval(refreshInterval);
  }, [deviceId]);

  // Fetch tab data when active tab changes (lazy loading)
  useEffect(() => {
    if (!deviceId || !deviceInfo) return;
    
    // Skip overview and system_info (already loaded with initial request)
    if (activeTab === 'overview' || activeTab === 'system_info') return;
    
    // Fetch data for this tab
    fetchTabData(activeTab, 1, historyLimit);
  }, [activeTab, deviceId, deviceInfo, fetchTabData, historyLimit]);

  const handleLogout = async () => {
    await logout();
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'online':
        return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Online</span>;
      case 'offline':
        return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Offline</span>;
      default:
        return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Unknown</span>;
    }
  };

  // Format system_info data (from initial load)
  const formatSystemInfo = (dataObject: any) => {
    const dataArray = dataObject?.data;
    if (!dataArray || !Array.isArray(dataArray) || dataArray.length === 0) {
      return <p className="text-gray-500">No system information available</p>;
    }

    const systemData = dataArray[0];
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div><span className="font-medium">Computer Name:</span> {systemData.computer_name || 'N/A'}</div>
          <div><span className="font-medium">Hostname:</span> {systemData.hostname || 'N/A'}</div>
          <div><span className="font-medium">OS Version:</span> {systemData.os_version || 'N/A'}</div>
          <div><span className="font-medium">Hardware Model:</span> {systemData.hardware_model || 'N/A'}</div>
          <div><span className="font-medium">CPU Brand:</span> {systemData.cpu_brand || 'N/A'}</div>
          <div><span className="font-medium">CPU Type:</span> {systemData.cpu_type || 'N/A'}</div>
          <div><span className="font-medium">CPU Cores:</span> {systemData.cpu_logical_cores ? `${systemData.cpu_logical_cores} logical, ${systemData.cpu_physical_cores} physical` : 'N/A'}</div>
          <div><span className="font-medium">Memory:</span> {systemData.physical_memory ? `${Math.round(parseInt(systemData.physical_memory) / (1024 * 1024 * 1024))} GB` : 'N/A'}</div>
          <div><span className="font-medium">Hardware Serial:</span> {systemData.hardware_serial || 'N/A'}</div>
          <div><span className="font-medium">Hardware Vendor:</span> {systemData.hardware_vendor || 'N/A'}</div>
          <div><span className="font-medium">UUID:</span> {systemData.uuid || 'N/A'}</div>
        </div>
      </div>
    );
  };

  // Format apps_info data (latest only)
  // Backend returns: { id, device_id, timestamp, data: [...apps] }
  // tabData stores: { data: { id, device_id, timestamp, data: [...apps] }, loaded: true, ... }
  const formatAppsInfo = (tabState: TabDataState | undefined) => {
    // Access the nested data array: tabState.data.data
    const appsArray = tabState?.data?.data;
    if (!appsArray || !Array.isArray(appsArray) || appsArray.length === 0) {
      return <p className="text-gray-500">No apps information available</p>;
    }

    const allKeys = appsArray[0] ? Object.keys(appsArray[0]) : [];
    
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-500 mb-2">Total: {appsArray.length} applications</p>
        <div className="max-h-96 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                {allKeys.map((key) => (
                  <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    {key.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {appsArray.map((app: any, index: number) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                  {allKeys.map((key) => (
                    <td key={key} className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={app[key] || 'N/A'}>
                      {app[key] || 'N/A'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Format history data (paginated table with timestamps)
  const formatHistoryData = (tabState: TabDataState, type: string) => {
    if (!tabState?.data || tabState.data.length === 0) {
      return <p className="text-gray-500">No {type.replace(/_/g, ' ')} history available</p>;
    }

    const getStatusValue = (record: any, type: string) => {
      const data = record.data?.[0] || record.data;
      switch (type) {
        case 'disk_encryption_info':
          return data?.disk_encryption === 'true';
        case 'password_manager_info':
          return data?.password_manager === 'true';
        case 'antivirus_info':
          return data?.antivirus_info === 'true' || data?.antivirus_status === 'true';
        case 'screen_lock_info':
          return data?.screen_lock === 'true';
        default:
          return false;
      }
    };

    const getExtraInfo = (record: any, type: string) => {
      const data = record.data?.[0] || record.data;
      switch (type) {
        case 'password_manager_info':
          return data?.password_manager_names || null;
        case 'screen_lock_info':
          return data?.grace_period ? `Grace: ${data.grace_period}s` : null;
        default:
          return null;
      }
    };

    return (
      <div className="space-y-4">
        {/* Pagination Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Show:</span>
            <div className="relative">
              <select
                value={historyLimit}
                onChange={(e) => setHistoryLimit(Number(e.target.value))}
                className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
            <span className="text-sm text-gray-600">records</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              Showing {tabState.data.length} of {tabState.total} records
            </span>
            {tabState.totalPages && tabState.totalPages > 1 && (
              <div className="flex gap-1">
                <button
                  onClick={() => fetchTabData(type, (tabState.page || 1) - 1, historyLimit)}
                  disabled={(tabState.page || 1) <= 1}
                  className="px-2 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="px-2 py-1 text-sm">
                  {tabState.page} / {tabState.totalPages}
                </span>
                <button
                  onClick={() => fetchTabData(type, (tabState.page || 1) + 1, historyLimit)}
                  disabled={(tabState.page || 1) >= (tabState.totalPages || 1)}
                  className="px-2 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        {/* History Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {tabState.data.map((record: any, index: number) => {
                const isEnabled = getStatusValue(record, type);
                const extraInfo = getExtraInfo(record, type);
                return (
                  <tr key={record.id || index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {((tabState.page || 1) - 1) * (tabState.limit || 10) + index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.timestamp ? formatAbsolute(record.timestamp) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs ${isEnabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {extraInfo || '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render tab content based on active tab
  const renderTabContent = () => {
    // Overview tab
    if (activeTab === 'overview') {
      return renderOverviewTab();
    }

    // System info - loaded with initial request
    if (activeTab === 'system_info') {
      return (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">System Info</h3>
          {formatSystemInfo(deviceInfo?.system_info)}
        </div>
      );
    }

    // Other tabs - lazy loaded
    const currentTabData = tabData[activeTab];

    // Show loading spinner
    if (currentTabData?.loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="md" />
          <span className="ml-3 text-gray-600">Loading {activeTab.replace(/_/g, ' ')}...</span>
        </div>
      );
    }

    // Show error
    if (currentTabData?.error) {
      return (
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            <h4 className="font-medium text-red-800">Failed to load data</h4>
          </div>
          <p className="text-red-700 mt-2">{currentTabData.error}</p>
          <button
            onClick={() => fetchTabData(activeTab, 1, historyLimit)}
            className="mt-3 px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200"
          >
            Retry
          </button>
        </div>
      );
    }

    // Show data
    const tabLabel = tabs.find(t => t.id === activeTab)?.label || activeTab;
    
    if (activeTab === 'apps_info') {
      return (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">{tabLabel}</h3>
          {formatAppsInfo(currentTabData)}
        </div>
      );
    }

    if (HISTORY_TABS.includes(activeTab)) {
      return (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">{tabLabel} History</h3>
          {formatHistoryData(currentTabData, activeTab)}
        </div>
      );
    }

    return <p className="text-gray-500">Unknown tab</p>;
  };

  // Render overview tab content
  const renderOverviewTab = () => {
    return (
      <div className="space-y-6">
        <div className="overflow-x-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-w-[600px] md:min-w-0">
            <div className="bg-gray-50 rounded-lg p-4">
              <button 
                onClick={() => setActiveTab('system_info')} 
                className="w-full text-left hover:bg-gray-100 rounded-lg p-2 transition-colors cursor-pointer"
              >
                <div className="flex items-center">
                  <Settings className="h-8 w-8 text-blue-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">System Info</p>
                    <p className={`text-xs ${deviceInfo?.system_info?.hasErrorStatus ? 'text-red-500' : deviceInfo?.system_info ? 'text-green-600' : 'text-gray-500'}`}>
                      {deviceInfo?.system_info?.hasErrorStatus ? 'Error' : deviceInfo?.system_info ? 'Available' : 'No data'}
                    </p>
                  </div>
                </div>
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <button 
                onClick={() => setActiveTab('disk_encryption_info')} 
                className="w-full text-left hover:bg-gray-100 rounded-lg p-2 transition-colors cursor-pointer"
              >
                <div className="flex items-center">
                  <HardDrive className="h-8 w-8 text-green-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">Disk Encryption</p>
                    <p className={`text-xs ${deviceInfo?.summary?.disk_encryption_info ? 'text-green-600' : 'text-gray-500'}`}>
                      {deviceInfo?.summary?.disk_encryption_info ? 'Enabled' : 'View History'}
                    </p>
                  </div>
                </div>
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <button 
                onClick={() => setActiveTab('password_manager_info')} 
                className="w-full text-left hover:bg-gray-100 rounded-lg p-2 transition-colors cursor-pointer"
              >
                <div className="flex items-center">
                  <Lock className="h-8 w-8 text-yellow-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">Password Manager</p>
                    <p className={`text-xs ${deviceInfo?.summary?.password_manager_info ? 'text-green-600' : 'text-gray-500'}`}>
                      {deviceInfo?.summary?.password_manager_info ? 'Enabled' : 'View History'}
                    </p>
                  </div>
                </div>
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <button 
                onClick={() => setActiveTab('antivirus_info')} 
                className="w-full text-left hover:bg-gray-100 rounded-lg p-2 transition-colors cursor-pointer"
              >
                <div className="flex items-center">
                  <Shield className="h-8 w-8 text-red-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">Antivirus</p>
                    <p className={`text-xs ${deviceInfo?.summary?.antivirus_info ? 'text-green-600' : 'text-gray-500'}`}>
                      {deviceInfo?.summary?.antivirus_info ? 'Enabled' : 'View History'}
                    </p>
                  </div>
                </div>
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <button 
                onClick={() => setActiveTab('screen_lock_info')} 
                className="w-full text-left hover:bg-gray-100 rounded-lg p-2 transition-colors cursor-pointer"
              >
                <div className="flex items-center">
                  <Eye className="h-8 w-8 text-indigo-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">Screen Lock</p>
                    <p className={`text-xs ${deviceInfo?.summary?.screen_lock_info ? 'text-green-600' : 'text-gray-500'}`}>
                      {deviceInfo?.summary?.screen_lock_info ? 'Enabled' : 'View History'}
                    </p>
                  </div>
                </div>
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <button 
                onClick={() => setActiveTab('apps_info')} 
                className="w-full text-left hover:bg-gray-100 rounded-lg p-2 transition-colors cursor-pointer"
              >
                <div className="flex items-center">
                  <Grid3X3 className="h-8 w-8 text-purple-600" />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">Applications</p>
                    <p className={`text-xs ${deviceInfo?.summary?.apps_info ? 'text-green-600' : 'text-gray-500'}`}>
                      {deviceInfo?.summary?.apps_info ? 'Available' : 'View Apps'}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Monitor },
    { id: 'system_info', label: 'System Info', icon: Settings },
    { id: 'disk_encryption_info', label: 'Disk Encryption', icon: HardDrive },
    { id: 'password_manager_info', label: 'Password Manager', icon: Lock },
    { id: 'antivirus_info', label: 'Antivirus', icon: Shield },
    { id: 'screen_lock_info', label: 'Screen Lock', icon: Eye },
    { id: 'apps_info', label: 'Applications', icon: Grid3X3 },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600">Loading device details...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">Error Loading Device</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link
            to="/devices"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Devices
          </Link>
        </div>
      </div>
    );
  }

  if (!deviceInfo?.device) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Monitor className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">Device Not Found</h2>
          <p className="text-gray-600 mb-4">The device you're looking for doesn't exist.</p>
          <Link
            to="/devices"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Devices
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Desktop Layout */}
          <div className="hidden sm:flex justify-between items-center">
            {/* Breadcrumb and Title */}
            <div className="flex items-center space-x-2">
              <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 transition-colors">
                Dashboard
              </Link>
              <div className="h-5 w-px bg-gray-300"></div>
              <Link to="/devices" className="text-gray-600 hover:text-gray-900 transition-colors">
                Devices
              </Link>
              <div className="h-5 w-px bg-gray-300"></div>
              <div className="flex items-center">
                <Monitor className="h-5 w-5 text-blue-600 mr-2" />
                <h1 className="text-xl font-semibold text-gray-900">
                  {deviceInfo.device.computer_name || 'Unknown Device'}
                </h1>
              </div>
            </div>

            {/* User menu */}
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-gray-600">Welcome back, </span>
                <span className="font-medium text-gray-900">
                  {admin?.name || admin?.email || 'Admin'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>

          {/* Mobile Layout */}
          <div className="sm:hidden space-y-2">
            {/* Row 1: Navigation + Sign out icon */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-sm overflow-x-auto">
                <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap">
                  Dashboard
                </Link>
                <div className="h-4 w-px bg-gray-300"></div>
                <Link to="/devices" className="text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap">
                  Devices
                </Link>
                <div className="h-4 w-px bg-gray-300"></div>
                <div className="flex items-center min-w-0">
                  <Monitor className="h-4 w-4 text-blue-600 mr-1 flex-shrink-0" />
                  <h1 className="text-sm font-semibold text-gray-900 truncate">
                    {deviceInfo.device.computer_name || 'Unknown Device'}
                  </h1>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
                title="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>

            {/* Row 2: Username only */}
            <div className="text-xs">
              <span className="text-gray-900 font-medium">
                {admin?.name || admin?.email || 'Admin'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 sm:px-6 lg:px-12 xl:px-16 py-8">
        {/* Device Overview Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base sm:text-lg font-medium text-gray-900 truncate">Device Overview</h2>
              {getStatusBadge(getDeviceStatus(deviceInfo.device.last_seen || null))}
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <div className="overflow-x-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 min-w-[600px] md:min-w-0">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Device Name</h3>
                <p className="mt-1 text-sm text-gray-900">{deviceInfo.device.computer_name || 'Unknown'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Owner</h3>
                <p className="mt-1 text-sm text-gray-900">{deviceInfo.device.user_email}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Serial Number</h3>
                <p className="mt-1 text-sm text-gray-900">{deviceInfo.device.serial_no}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">OS Version</h3>
                <p className="mt-1 text-sm text-gray-900">{deviceInfo.device.os_type} {deviceInfo.device.os_version}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">ScanX Version</h3>
                <p className="mt-1 text-sm text-gray-900">{deviceInfo.device.scanx_version || 'Unknown'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Osqueryi Version</h3>
                <p className="mt-1 text-sm text-gray-900">{deviceInfo.device.osqueryi_version || 'Unknown'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Last Seen</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {deviceInfo.device.last_seen ? formatAbsolute(deviceInfo.device.last_seen.toString()) : 'Never'}
                </p>
              </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="-mb-px flex space-x-4 sm:space-x-8 px-4 sm:px-6 min-w-max">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 cursor-pointer'
                      }`}
                  >
                    <Icon className="h-4 w-4 mr-1 sm:mr-2" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-4 sm:p-6">
            {renderTabContent()}
          </div>
        </div>
      </main>
    </div>
  );
}