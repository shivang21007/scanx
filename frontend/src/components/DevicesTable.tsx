import { DeviceTableRow } from '../types/device';
import { CheckCircle, XCircle, Monitor, Trash2, Apple, Square, Cpu, ChevronUp, ChevronDown } from 'lucide-react';
import { formatRelative, getDeviceStatus } from '../utils/timezone';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@/services/api';
import toast, { Toaster } from 'react-hot-toast';

interface DevicesTableProps {
  devices: DeviceTableRow[];
  loading?: boolean;
  osVersionSort?: 'asc' | 'desc' | null;
  onOsVersionSort?: () => void;
  passwordManagerFilter?: 'true' | 'false' | null;
  diskEncryptionFilter?: 'true' | 'false' | null;
  antivirusFilter?: 'true' | 'false' | null;
  screenLockFilter?: 'true' | 'false' | null;
  onSecurityFilter?: (filterType: 'password_manager' | 'disk_encryption' | 'antivirus' | 'screen_lock') => void;
  lastCheckSort?: 'asc' | 'desc';
  onLastCheckSort?: () => void;
  onDeviceDeleted?: () => Promise<any>;
}

export function DevicesTable({ 
  devices, 
  loading, 
  osVersionSort, 
  onOsVersionSort,
  passwordManagerFilter,
  diskEncryptionFilter,
  antivirusFilter,
  screenLockFilter,
  onSecurityFilter,
  lastCheckSort,
  onLastCheckSort,
  onDeviceDeleted 
}: DevicesTableProps) {
  const navigate = useNavigate();

  const getSecurityHeaderClass = (filter: 'true' | 'false' | null | undefined) => {
    if (filter === 'false') {
      return 'text-red-600 font-semibold';
    } else if (filter === 'true') {
      return 'text-green-600 font-semibold';
    }
    return 'text-gray-500';
  };


  const handleDeviceClick = (deviceId: number) => {
    navigate(`/devices/${deviceId}`);
  };
  const getOSIcon = (osType: string) => {
    switch (osType.toLowerCase()) {
      case 'darwin':
        return <Apple className="h-4 w-4 text-gray-600" />;
      case 'windows':
        return <Square className="h-4 w-4 text-blue-600" />;
      case 'linux':
        return <Cpu className="h-4 w-4 text-orange-600" />;
      default:
        return <Monitor className="h-4 w-4 text-gray-400" />;
    }
  };

  const getOSDisplayName = (osType: string) => {
    switch (osType.toLowerCase()) {
      case 'darwin':
        return 'macOS';
      case 'windows':
        return 'Windows';
      case 'linux':
        return 'Linux';
      default:
        return osType;
    }
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

  const SecurityIcon = ({ enabled, label }: { enabled: boolean; label: string }) => (
    <div className="flex justify-center" title={`${label}: ${enabled ? 'Enabled' : 'Disabled'}`}>
      {enabled ? (
        <CheckCircle className="h-5 w-5 text-green-500" />
      ) : (
        <XCircle className="h-5 w-5 text-red-500" />
      )}
    </div>
  );

  if (devices.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-8 text-center">
          <Monitor className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No devices found</h3>
          <p className="text-gray-500">
            No devices match your current search criteria. Try adjusting your filters.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      <Toaster position="top-right" />
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Device
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Owner
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center space-x-1">
                  <span>OS Version</span>
                  {onOsVersionSort && (
                    <button
                      onClick={onOsVersionSort}
                      className="flex flex-col items-center justify-center ml-1 hover:bg-gray-100 rounded p-0.5 transition-colors"
                      title={
                        osVersionSort === null 
                          ? 'Sort by OS Version (Ascending)' 
                          : osVersionSort === 'asc' 
                          ? 'Sort by OS Version (Descending)' 
                          : 'Clear OS Version Sort'
                      }
                    >
                      <ChevronUp 
                        strokeWidth={osVersionSort === 'desc' ? 3 : 2}
                        className={`h-3 w-3 transition-opacity ${
                          osVersionSort === 'desc' 
                            ? 'text-blue-600 opacity-100' 
                            : osVersionSort === 'asc'
                            ? 'text-gray-400 opacity-10'
                            : 'text-gray-400 opacity-50'
                        }`} 
                      />
                      <ChevronDown 
                        strokeWidth={osVersionSort === 'asc' ? 3 : 2}
                        className={`h-3 w-3 transition-opacity -mt-0.5 ${
                          osVersionSort === 'asc' 
                            ? 'text-blue-600 opacity-100' 
                            : osVersionSort === 'desc'
                            ? 'text-gray-400 opacity-10'
                            : 'text-gray-400 opacity-50'
                        }`} 
                      />
                    </button>
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Monitoring
              </th>
              <th 
                className={`px-6 py-3 text-center text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors ${getSecurityHeaderClass(passwordManagerFilter)}`}
                title="Password Manager - Click to filter"
                onClick={() => onSecurityFilter?.('password_manager')}
              >
                PW
              </th>
              <th 
                className={`px-6 py-3 text-center text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors ${getSecurityHeaderClass(diskEncryptionFilter)}`}
                title="Hard Disk Encryption - Click to filter"
                onClick={() => onSecurityFilter?.('disk_encryption')}
              >
                HD
              </th>
              <th 
                className={`px-6 py-3 text-center text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors ${getSecurityHeaderClass(antivirusFilter)}`}
                title="Antivirus - Click to filter"
                onClick={() => onSecurityFilter?.('antivirus')}
              >
                AV
              </th>
              <th 
                className={`px-6 py-3 text-center text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors ${getSecurityHeaderClass(screenLockFilter)}`}
                title="Screen Lock - Click to filter"
                onClick={() => onSecurityFilter?.('screen_lock')}
              >
                SL
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center space-x-1">
                  <span>Last Check</span>
                  {onLastCheckSort && (
                    <button
                      onClick={onLastCheckSort}
                      className="flex flex-col items-center justify-center ml-1 hover:bg-gray-100 rounded p-0.5 transition-colors"
                      title={
                        lastCheckSort === 'desc' 
                          ? 'Sort by Last Check (Oldest First)' 
                          : 'Sort by Last Check (Latest First)'
                      }
                    >
                      <ChevronUp 
                        strokeWidth={lastCheckSort === 'asc' ? 3 : 2}
                        className={`h-3 w-3 transition-opacity ${
                          lastCheckSort === 'asc' 
                            ? 'text-blue-600 opacity-100' 
                            : 'text-gray-400 opacity-50'
                        }`} 
                      />
                      <ChevronDown 
                        strokeWidth={lastCheckSort === 'desc' ? 3 : 2}
                        className={`h-3 w-3 transition-opacity -mt-0.5 ${
                          lastCheckSort === 'desc' 
                            ? 'text-blue-600 opacity-100' 
                            : 'text-gray-400 opacity-50'
                        }`} 
                      />
                    </button>
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {devices.map((device) => (
              <tr key={device.id} className="hover:bg-gray-50 transition-colors">
                {/* Device Column */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <button
                      onClick={() => handleDeviceClick(device.id)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-900 transition-colors cursor-pointer"
                    >
                      {device.computer_name || 'Unknown Device'}
                    </button>
                    <div className="text-sm text-gray-500">
                      {device.serial_no}
                    </div>
                  </div>
                </td>

                {/* Owner Column */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <button
                      onClick={() => handleDeviceClick(device.id)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-900 transition-colors cursor-pointer"
                    >
                      {device.owner_name}
                    </button>
                    <div className="text-sm text-gray-500">
                      {device.user_email}
                    </div>
                  </div>
                </td>

                {/* OS Version Column */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="mr-3">
                      {getOSIcon(device.os_type)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {getOSDisplayName(device.os_type)} {device.os_version}
                      </div>
                      <div className="text-sm text-gray-500">
                        {getStatusBadge(getDeviceStatus(device.last_report || null))}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Monitoring Column */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    <div>scanx: {device.scanx_version || 'Unknown'}</div>
                    <div className="text-gray-500 text-xs mt-0.5">osqueryi: {device.osqueryi_version || 'Unknown'}</div>
                  </div>
                </td>

                {/* Security Status Columns */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <SecurityIcon 
                    enabled={device.security_status.password_manager} 
                    label="Password Manager"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <SecurityIcon 
                    enabled={device.security_status.disk_encryption} 
                    label="Disk Encryption"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <SecurityIcon 
                    enabled={device.security_status.antivirus} 
                    label="Antivirus"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <SecurityIcon 
                    enabled={device.security_status.screen_lock} 
                    label="Screen Lock"
                  />
                </td>

                {/* Last Check Column */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {device.last_report ? formatRelative(device.last_report) : 'Never'}
                  </div>
                </td>

                {/* Actions Column */}
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <button
                    className="text-red-600 hover:text-red-900 transition-all duration-150 cursor-pointer active:scale-75 hover:scale-110"
                    onClick={async () => {
                      //console.log('Remove device:', device.id);
                      if (confirm(`Are you sure you want to remove ${device.computer_name} (${device.serial_no})? This action cannot be undone.`)) {
                        try {
                          const message = await apiService.deleteDeviceById(device.id);
                          //console.log('Device removed:', message);
                          // Notify parent component to refresh the data
                          if (onDeviceDeleted) {
                            await onDeviceDeleted();
                          }
                          toast.success(`Device removed: ${message}`);
                        } catch (error: any) {
                          console.error('Failed to delete device:', error);
                          toast.error(`Failed to delete device: ${error.message || 'Unknown error'}`);
                        }
                      }
                    }}
                    title="Remove device"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <div className="text-sm text-gray-500">Updating...</div>
        </div>
      )}
    </div>
  );
}