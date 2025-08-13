import { useState, useEffect, useRef } from 'react';
import { User } from '../types/user';
import { Trash2, ChevronDown, User as UserIcon, Settings } from 'lucide-react';

interface UsersTableProps {
    users: User[];
    loading?: boolean;
    onUpdateAccountType: (gid: number, accountType: 'user' | 'service') => Promise<void>;
    onDeleteUser: (gid: number) => Promise<void>;
}

export function UsersTable({ users, loading, onUpdateAccountType, onDeleteUser }: UsersTableProps) {
    const [updatingUser, setUpdatingUser] = useState<number | null>(null);
    const [deletingUser, setDeletingUser] = useState<number | null>(null);
    const [openDropdown, setOpenDropdown] = useState<number | null>(null);
    const dropdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const clickedElement = event.target as Node;
            const isOutsideAllDropdowns = Object.values(dropdownRefs.current).every(
                ref => !ref || !ref.contains(clickedElement)
            );

            if (isOutsideAllDropdowns) {
                setOpenDropdown(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleAccountTypeChange = async (gid: number, accountType: 'user' | 'service') => {
        console.log('Updating account type for user', gid, 'to', accountType); // Debug log
        setUpdatingUser(gid);
        try {
            await onUpdateAccountType(gid, accountType);
            console.log('Account type updated successfully'); // Debug log
        } catch (error) {
            console.error('Failed to update account type:', error);
        } finally {
            setUpdatingUser(null);
            setOpenDropdown(null);
        }
    };

    const handleDeleteUser = async (gid: number) => {
        if (window.confirm(`Are you sure you want to delete ${users.find(user => user.gid === gid)?.name}? This action cannot be undone.`)) {
            setDeletingUser(gid);
            try {
                await onDeleteUser(gid);
            } finally {
                setDeletingUser(null);
            }
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getAccountTypeIcon = (accountType: string) => {
        switch (accountType) {
            case 'user':
                return <UserIcon className="h-4 w-4 text-blue-600" />;
            case 'service':
                return <Settings className="h-4 w-4 text-purple-600" />;
            default:
                return <UserIcon className="h-4 w-4 text-gray-400" />;
        }
    };

    const getAccountTypeBadge = (accountType: string) => {
        switch (accountType) {
            case 'user':
                return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">User</span>;
            case 'service':
                return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">Service</span>;
            default:
                return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Unknown</span>;
        }
    };

    if (users.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-8 text-center">
                    <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
                    <p className="text-gray-500">
                        No users match your current search criteria. Try adjusting your filters.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                User
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Email
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Account Type
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Created
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((user) => (
                            <tr key={user.gid} className="hover:bg-gray-50 transition-colors">
                                {/* User Column */}
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10">
                                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                                <UserIcon className="h-6 w-6 text-gray-600" />
                                            </div>
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">
                                                {user.name}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                ID: {user.gid}
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                {/* Email Column */}
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">
                                        {user.email}
                                    </div>
                                </td>

                                {/* Account Type Column */}
                                <td className="px-4 py-4 whitespace-nowrap relative overflow-visible">
                                    <div className="flex items-center space-x-2">
                                        {getAccountTypeIcon(user.account_type)}
                                        <div className="relative inline-block" ref={(el) => { dropdownRefs.current[user.gid] = el; }}>
                                            <button
                                                onClick={() => setOpenDropdown(openDropdown === user.gid ? null : user.gid)}
                                                className="flex items-center space-x-1 text-sm text-gray-900 hover:text-gray-700 focus:outline-none"
                                                disabled={updatingUser === user.gid}
                                            >
                                                {getAccountTypeBadge(user.account_type)}
                                                <ChevronDown className="h-4 w-4" />
                                            </button>

                                            {/* Dropdown Menu */}
                                            
                                            {openDropdown === user.gid && (
                                                <div className="absolute z-50 top-full left-0 mt-1 w-32 bg-white rounded-md shadow-lg border border-gray-200">
                                                    {/* MODIFICATION 1: Add flex flex-col here to stack the buttons */}
                                                    <div className="py-1 flex flex-col">
                                                        {/* MODIFICATION 2: Button structure simplified */}
                                                        <button
                                                            onClick={() => handleAccountTypeChange(user.gid, 'user')}
                                                            disabled={updatingUser === user.gid}
                                                            className={`w-full flex items-center space-x-2 px-4 py-2 text-sm text-left hover:bg-gray-100 ${user.account_type === 'user' ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                                                                } ${updatingUser === user.gid ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            <UserIcon className="h-4 w-4" />
                                                            <span>User</span>
                                                        </button>

                                                        <button
                                                            onClick={() => handleAccountTypeChange(user.gid, 'service')}
                                                            disabled={updatingUser === user.gid}
                                                            className={`w-full flex items-center space-x-2 px-4 py-2 text-sm text-left hover:bg-gray-100 ${user.account_type === 'service' ? 'bg-purple-50 text-purple-700' : 'text-gray-700'
                                                                } ${updatingUser === user.gid ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            <Settings className="h-4 w-4" />
                                                            <span>Service</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Loading indicator */}
                                    {updatingUser === user.gid && (
                                        <div className="mt-1 text-xs text-gray-500">Updating...</div>
                                    )}
                                </td>

                                {/* Created Column */}
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">
                                        {formatDate(user.created_at)}
                                    </div>
                                </td>

                                {/* Actions Column */}
                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                    <button
                                        onClick={() => handleDeleteUser(user.gid)}
                                        disabled={deletingUser === user.gid}
                                        className={`text-red-600 hover:text-red-900 transition-colors ${deletingUser === user.gid ? 'opacity-50 cursor-not-allowed' : ''
                                            }`}
                                        title="Delete user"
                                    >
                                        {deletingUser === user.gid ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                        ) : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
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
