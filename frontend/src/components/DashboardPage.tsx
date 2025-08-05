
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, Monitor, Shield, Users, Activity, AlertTriangle } from 'lucide-react';
import { apiService } from '../services/api';
import { DashboardStats, Device } from '../types/device';
import { LoadingSpinner } from './LoadingSpinner';

export function DashboardPage() {
  const { admin, logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch dashboard stats and devices in parallel
        const [dashboardStats, devicesList] = await Promise.all([
          apiService.getDashboardStats(),
          apiService.getDevices()
        ]);
        
        setStats(dashboardStats);
        setDevices(devicesList);
      } catch (err: any) {
        console.error('Failed to fetch dashboard data:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  // Calculate secure devices (devices with disk encryption)
  const secureDevices = devices.filter(device => 
    device.status === 'online' && device.os_type // You can add more security criteria
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
            <div className="flex items-center justify-center mr-0.5">
              <img 
                src="/favicon.ico" 
                alt="ScanX Logo" 
                className="w-8 h-8"
              />
            </div>
              <span className="text-xl font-semibold text-gray-900">ScanX</span>
            </div>

            {/* User Menu */}
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
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to ScanX Dashboard
          </h1>
          <p className="text-gray-600">
            Manage and monitor your devices from this central dashboard.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" />
            <span className="ml-3 text-gray-600">Loading dashboard data...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {!loading && !error && stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <Monitor className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Devices</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <Activity className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Online Devices</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.online}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <Shield className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Secure Devices</p>
                  <p className="text-2xl font-bold text-gray-900">{secureDevices}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Recent Activity</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.recent_activity}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Content */}
        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Devices */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Recent Devices</h3>
              </div>
              <div className="p-6">
                {devices.length > 0 ? (
                  <div className="space-y-4">
                    {devices.slice(0, 5).map((device) => (
                      <div key={device.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <Monitor className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{device.user_email}</p>
                            <p className="text-xs text-gray-500">{device.serial_no}</p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            device.status === 'online' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {device.status}
                          </span>
                          <span className="text-xs text-gray-500 ml-2">{device.os_type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Monitor className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No devices found</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Devices will appear here once agents start reporting
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* OS Distribution */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">OS Distribution</h3>
              </div>
              <div className="p-6">
                {stats && stats.by_os.length > 0 ? (
                  <div className="space-y-4">
                    {stats.by_os.map((os, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-4 h-4 rounded bg-blue-500 mr-3"></div>
                          <span className="text-sm text-gray-600 capitalize">{os.os_type}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-900 mr-2">{os.count}</span>
                          <span className="text-xs text-gray-500">
                            ({stats.total > 0 ? Math.round((os.count / stats.total) * 100) : 0}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No OS data available</p>
                    <p className="text-sm text-gray-400 mt-1">
                      OS distribution will appear here once devices are connected
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Admin Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-4">Account Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-blue-700 font-medium">Email</p>
              <p className="text-blue-900">{admin?.email}</p>
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Name</p>
              <p className="text-blue-900">{admin?.name || 'Not set'}</p>
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Account Created</p>
              <p className="text-blue-900">
                {admin?.created_at ? new Date(admin.created_at).toLocaleDateString() : 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Last Updated</p>
              <p className="text-blue-900">
                {admin?.updated_at ? new Date(admin.updated_at).toLocaleDateString() : 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}