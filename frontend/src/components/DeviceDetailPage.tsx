import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Monitor, ChevronLeft, Shield, Settings, Grid3X3, HardDrive, Lock, Eye, AlertTriangle } from 'lucide-react';
import { apiService } from '../services/api';

import { LoadingSpinner } from './LoadingSpinner';
import { formatRelative, getDeviceStatus } from '../utils/timezone';

export function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { admin, logout } = useAuth();
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const deviceId = parseInt(id || '0');

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

        // Single API call to get everything
        const response = await apiService.getDeviceById(deviceId);
        console.log('Complete device response:', response);
        console.log('Device basic info:', response.device);
        console.log('Device summary:', response.summary);
        console.log('Available data types:', Object.keys(response.data || {}));

        setDeviceInfo(response);
      } catch (err: any) {
        console.error('Failed to fetch device details:', err);
        setError(err.message || 'Failed to load device details');
      } finally {
        setLoading(false);
      }
    };

    fetchDeviceDetails();
  }, [deviceId]);

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

  const formatDataForDisplay = (dataObject: any, type: string) => {
    console.log(`Formatting data for ${type}:`, dataObject);

    // Extract actual data from the response object
    const dataArray = dataObject?.data;
    if (!dataArray || !Array.isArray(dataArray) || dataArray.length === 0) {
      console.log(`No data available for ${type}`);
      return <p className="text-gray-500">No {type.replace('_', ' ')} information available</p>;
    }

    // Check for error status in the data
    const firstItem = dataArray[0];
    if (firstItem && (firstItem.status || firstItem.error || firstItem.hasErrorStatus)) {
      const errorMessage = firstItem.errorMessage || firstItem.status || firstItem.error || 'Unknown error';
      return (
        <div className="space-y-3">
          <div className="border border-red-200 rounded-lg p-4 bg-red-50">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              <h4 className="font-medium text-red-800">Error in {type.replace('_', ' ')}</h4>
            </div>
            <p className="text-red-700 mt-2 mb-3">{errorMessage}</p>
            <details className="mt-3">
              <summary className="text-sm text-red-600 cursor-pointer hover:text-red-800">
                View Raw Error Data
              </summary>
              <pre className="mt-2 bg-red-100 p-3 rounded text-xs text-red-800 overflow-x-auto">
                {JSON.stringify(dataArray, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    switch (type) {
      case 'system_info':
        const systemData = dataArray[0]; // First item contains system info
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
      case 'disk_encryption_info':
        const diskData = dataArray[0]; // First item contains disk encryption info
        return (
          <div className="space-y-3">
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">Disk Encryption Status</h4>
              <div className="grid grid-cols-2 gap-4">
                <div><span className="font-medium">Encrypted:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${diskData.disk_encryption === 'true' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {diskData.disk_encryption === 'true' ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      case 'apps_info':
        return (
          <div className="space-y-3">
            {dataArray.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bundle Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Display Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bundle ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {dataArray.map((app: any, index: number) => (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{app.bundle_name || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{app.display_name || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{app.bundle_identifier || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{app.bundle_version || app.bundle_short_version || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No apps information available</p>
            )}
          </div>
        );
      case 'password_manager_info':
        const passwordData = dataArray[0];
        return (
          <div className="space-y-3">
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">Password Manager Status</h4>
              <div className="grid grid-cols-2 gap-4">
                <div><span className="font-medium">Enabled:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${passwordData.password_manager === 'true' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {passwordData.password_manager === 'true' ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      case 'antivirus_info':
        const antivirusData = dataArray[0];
        return (
          <div className="space-y-3">
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">Antivirus Status</h4>
              <div className="grid grid-cols-2 gap-4">
                <div><span className="font-medium">Enabled:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${antivirusData.antivirus_info === 'true' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {antivirusData.antivirus_info === 'true' ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      case 'screen_lock_info':
        const screenData = dataArray[0];
        return (
          <div className="space-y-3">
            <div className="border rounded-lg p-4">
              <h4 className="font-medium mb-2">Screen Lock Status</h4>
              <div className="grid grid-cols-2 gap-4">
                <div><span className="font-medium">Enabled:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${screenData.screen_lock === 'true' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {screenData.screen_lock === 'true' ? 'Yes' : 'No'}
                  </span>
                </div>
                <div><span className="font-medium">Grace Period:</span> {screenData.grace_period ? `${screenData.grace_period} seconds` : 'N/A'}</div>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-3">
            <h4 className="font-medium mb-2">Raw Data</h4>
            <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto">
              {JSON.stringify(dataArray, null, 2)}
            </pre>
          </div>
        );
    }
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
          <div className="flex justify-between items-center">
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
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 sm:px-6 lg:px-12 xl:px-16 py-8">
        {/* Device Overview Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Device Overview</h2>
              {getStatusBadge(getDeviceStatus(deviceInfo.device.last_seen || null))}
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                <h3 className="text-sm font-medium text-gray-500">Agent Version</h3>
                <p className="mt-1 text-sm text-gray-900">v{deviceInfo.device.agent_version || 'Unknown'}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Last Seen</h3>
                <p className="mt-1 text-sm text-gray-900">
                  {deviceInfo.device.last_seen ? formatRelative(deviceInfo.device.last_seen.toString()) : 'Never'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 cursor-pointer'
                      }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <button 
                      onClick={() => setActiveTab('system_info')} 
                      className="w-full text-left hover:bg-gray-100 rounded-lg p-2 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center">
                        <Settings className="h-8 w-8 text-blue-600" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">System Info</p>
                          <p className={`text-xs ${deviceInfo.data?.system_info?.hasErrorStatus ? 'text-red-500' : deviceInfo.data?.system_info ? 'text-green-600' : 'text-gray-500'}`}>
                            {deviceInfo.data?.system_info?.hasErrorStatus ? 'Error' : deviceInfo.data?.system_info ? 'Available' : 'No data'}
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
                          <p className={`text-xs ${deviceInfo.data?.disk_encryption_info?.hasErrorStatus ? 'text-red-500' : deviceInfo.data?.disk_encryption_info ? 'text-green-600' : 'text-gray-500'}`}>
                            {deviceInfo.data?.disk_encryption_info?.hasErrorStatus ? 'Error' : deviceInfo.data?.disk_encryption_info ? 'Available' : 'No data'}
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
                          <p className={`text-xs ${deviceInfo.data?.password_manager_info?.hasErrorStatus ? 'text-red-500' : deviceInfo.data?.password_manager_info ? 'text-green-600' : 'text-gray-500'}`}>
                            {deviceInfo.data?.password_manager_info?.hasErrorStatus ? 'Error' : deviceInfo.data?.password_manager_info ? 'Available' : 'No data'}
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
                          <p className={`text-xs ${deviceInfo.data?.antivirus_info?.hasErrorStatus ? 'text-red-500' : deviceInfo.data?.antivirus_info ? 'text-green-600' : 'text-gray-500'}`}>
                            {deviceInfo.data?.antivirus_info?.hasErrorStatus ? 'Error' : deviceInfo.data?.antivirus_info ? 'Available' : 'No data'}
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
                          <p className={`text-xs ${deviceInfo.data?.screen_lock_info?.hasErrorStatus ? 'text-red-500' : deviceInfo.data?.screen_lock_info ? 'text-green-600' : 'text-gray-500'}`}>
                            {deviceInfo.data?.screen_lock_info?.hasErrorStatus ? 'Error' : deviceInfo.data?.screen_lock_info ? 'Available' : 'No data'}
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
                          <p className={`text-xs ${deviceInfo.data?.apps_info?.hasErrorStatus ? 'text-red-500' : deviceInfo.data?.apps_info?.data ? 'text-green-600' : 'text-gray-500'}`}>
                            {deviceInfo.data?.apps_info?.hasErrorStatus ? 'Error' : deviceInfo.data?.apps_info?.data ? `${deviceInfo.data.apps_info.data.length || 0} apps` : 'No data'}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
                
                {/* Error Summary */}
                {(() => {
                  const errorTypes = Object.entries(deviceInfo.data || {}).filter(([, value]: [string, any]) => value?.hasErrorStatus);
                  if (errorTypes.length > 0) {
                    return (
                      <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                        <div className="flex items-center">
                          <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                          <h4 className="font-medium text-red-800">Data Collection Errors</h4>
                        </div>
                        <p className="text-red-700 mt-2 mb-3">
                          The following data types have collection errors:
                        </p>
                        <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                          {errorTypes.map(([key, value]: [string, any]) => (
                            <li key={key}>
                              <span className="font-medium">{key.replace('_', ' ')}:</span> {value.errorMessage || 'Unknown error'}
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-red-600 mt-3">
                          Click on individual tabs to view detailed error information and raw data.
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {tabs.find(tab => tab.id === activeTab)?.label}
                </h3>
                {formatDataForDisplay(deviceInfo.data?.[activeTab], activeTab)}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}