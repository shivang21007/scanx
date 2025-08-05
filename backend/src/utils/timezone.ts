/**
 * IST (India Standard Time) Utility Functions
 * UTC+5:30 timezone handling
 */

// IST offset: +5 hours 30 minutes from UTC
export const IST_OFFSET_HOURS = 5;
export const IST_OFFSET_MINUTES = 30;
export const IST_OFFSET_MS = (IST_OFFSET_HOURS * 60 + IST_OFFSET_MINUTES) * 60 * 1000;

/**
 * Get current IST Date object
 */
export function getCurrentIST(): Date {
    const utc = new Date();
    return new Date(utc.getTime() + IST_OFFSET_MS);
}

/**
 * Convert UTC Date to IST Date
 */
export function utcToIST(utcDate: Date): Date {
    return new Date(utcDate.getTime() + IST_OFFSET_MS);
}

/**
 * Convert IST Date to UTC Date
 */
export function istToUTC(istDate: Date): Date {
    return new Date(istDate.getTime() - IST_OFFSET_MS);
}

/**
 * Get current IST timestamp in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ format but in IST)
 */
export function getCurrentISTString(): string {
    return getCurrentIST().toISOString().replace('Z', '+05:30');
}

/**
 * Get IST timestamp string from UTC date
 */
export function utcToISTString(utcDate: Date): string {
    return utcToIST(utcDate).toISOString().replace('Z', '+05:30');
}

/**
 * Parse timestamp string and convert to IST Date
 * Handles both UTC and IST input strings
 */
export function parseToIST(timestampString: string): Date {
    const parsedDate = new Date(timestampString);
    
    // If the string already contains IST offset (+05:30), it's already in IST
    if (timestampString.includes('+05:30')) {
        return parsedDate;
    }
    
    // Otherwise, treat as UTC and convert to IST
    return utcToIST(parsedDate);
}

/**
 * Format IST date for MySQL TIMESTAMP
 * Returns: YYYY-MM-DD HH:mm:ss
 */
export function formatForMySQL(istDate: Date): string {
    return istDate.toISOString()
        .replace('T', ' ')
        .replace(/\.\d{3}Z$/, '');
}

/**
 * Get current IST timestamp for MySQL
 */
export function getCurrentMySQLTimestamp(): string {
    return formatForMySQL(getCurrentIST());
}

/**
 * Format IST date for display (human readable)
 * Returns: DD/MM/YYYY HH:mm:ss IST
 */
export function formatForDisplay(istDate: Date): string {
    const day = String(istDate.getDate()).padStart(2, '0');
    const month = String(istDate.getMonth() + 1).padStart(2, '0');
    const year = istDate.getFullYear();
    const hours = String(istDate.getHours()).padStart(2, '0');
    const minutes = String(istDate.getMinutes()).padStart(2, '0');
    const seconds = String(istDate.getSeconds()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds} IST`;
}

/**
 * Console log with IST timestamp
 */
export function logWithIST(message: string, ...args: any[]): void {
    const istTime = formatForDisplay(getCurrentIST());
    console.log(`[${istTime}] ${message}`, ...args);
}