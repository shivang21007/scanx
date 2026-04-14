/**
 * Simple relative time formatting for frontend display
 * Backend handles IST conversion, this just formats relative time
 */
export function formatRelative(timestampString: string): string {
  const date = new Date(timestampString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  
  // For older dates, use simple date format
  return date.toLocaleDateString();
}

/**
 * Format absolute time with date and time
 * Example: "Dec 15, 2025 at 10:30:45 AM"
 */
export function formatAbsolute(timestampString: string): string {
  const date = new Date(timestampString);
  
  // Format: "Dec 15, 2025 at 10:30:45 AM"
  const dateOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  };
  
  const datePart = date.toLocaleDateString('en-US', dateOptions);
  const timePart = date.toLocaleTimeString('en-US', timeOptions);
  
  return `${datePart} at ${timePart}`;
}

/**
 * Format timestamp as DD/MM/YY HH:MM in 24-hour format
 * Used on the dashboard table for "Last Check" column
 */
export function formatDashboardTimestamp(timestampString: string): string {
  const date = new Date(timestampString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function getDeviceStatus(lastReportTimestamp: string | null): 'online' | 'offline' {
  if (!lastReportTimestamp) {
    return 'offline';
  }
  
  const lastReport = new Date(lastReportTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - lastReport.getTime();
  const diffHours = diffMs / (1000 * 60 * 60); // Convert to hours
  
  // Device is offline if last report is older than 24 hours
  return diffHours > 24 ? 'offline' : 'online';
}