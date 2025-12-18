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