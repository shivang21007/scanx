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