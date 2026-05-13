import fs from 'fs';
import path from 'path';
import { UsersModel, AccountType } from '../models/Users';
import { google } from 'googleapis';
import { getCurrentIST, istToUTC, formatForDisplay } from '../utils/timezone';
import { systemLog } from '../logger/logger';

// Target sync time: 12:00 PM IST (noon) every day
const SYNC_HOUR_IST = 12; // 12 PM
const SYNC_MINUTE_IST = 0; // 0 minutes

// Minimal pluggable interface for Google Directory list function
export interface GoogleDirectoryUser {
  primaryEmail?: string;
  name?: { fullName?: string };
  creationTime?: string;
}

export interface GoogleDirectoryClient {
  listUsers: (pageToken?: string) => Promise<{ users: GoogleDirectoryUser[]; nextPageToken?: string }>; 
}

// Example local adapter reading from test_dir/users.json for development fallback
export class FileDirectoryClient implements GoogleDirectoryClient {
  constructor(private filePath: string) {}
  async listUsers(): Promise<{ users: GoogleDirectoryUser[]; nextPageToken?: string }> {
    const raw = fs.readFileSync(this.filePath, 'utf8');
    const arr = JSON.parse(raw);
    return { users: arr, nextPageToken: undefined };
  }
}

export interface GoogleServiceOptions {
  keyFile: string;
  adminEmail: string;
  customer?: string; // default 'my_customer'
}

export class GoogleApiDirectoryClient implements GoogleDirectoryClient {
  private service: any;
  private customer: string;
  constructor(opts: GoogleServiceOptions) {
    const auth = new google.auth.GoogleAuth({
      keyFile: opts.keyFile,
      scopes: ['https://www.googleapis.com/auth/admin.directory.user.readonly'],
    });
    const subjectClientPromise = auth.getClient().then((client) => {
      // Impersonate admin via domain-wide delegation
      (client as any).subject = opts.adminEmail;
      return client;
    });
    this.service = google.admin({ version: 'directory_v1', auth: auth });
    // google.admin with GoogleAuth will use provided getClient; we set subject on actual client above
    // but Admin SDK picks from GoogleAuth; ensure subject set by calling getClient once
    subjectClientPromise.catch(() => {});
    this.customer = opts.customer || 'my_customer';
  }
  async listUsers(pageToken?: string) {
    const res = await this.service.users.list({
      customer: this.customer,
      projection: 'full',
      maxResults: 500,
      pageToken,
    });
    const users: GoogleDirectoryUser[] = (res.data.users || []).map((u: any) => ({
      primaryEmail: u.primaryEmail,
      name: { fullName: u.name?.fullName },
      creationTime: u.creationTime,
    }));
    const next = res.data.nextPageToken || undefined;
    return { users, nextPageToken: next };
  }
}

export async function syncUsersFromGoogle(client: GoogleDirectoryClient): Promise<number> {
  let upserts = 0;
  let pageToken: string | undefined = undefined;
  do {
    const { users, nextPageToken } = await client.listUsers(pageToken);
    pageToken = nextPageToken;
    const records = users
      .filter(u => (u.primaryEmail || '').includes('@'))
      .map(u => ({
        email: u.primaryEmail as string,
        name: (u.name?.fullName || '').trim() || (u.primaryEmail as string),
        createdAt: u.creationTime || null,
        account_type: 'user' as AccountType,
      }));
    upserts += await UsersModel.upsertMany(records);
  } while (pageToken);
  return upserts;
}

/**
 * Calculate milliseconds until next 12 PM IST
 */
function getMsUntilNext12PMIST(): number {
  const nowIST = getCurrentIST();
  const targetIST = new Date(nowIST);
  
  // Set target to today at 12:00 PM IST
  targetIST.setHours(SYNC_HOUR_IST, SYNC_MINUTE_IST, 0, 0);
  
  // If we've already passed 12 PM today, schedule for tomorrow
  if (nowIST >= targetIST) {
    targetIST.setDate(targetIST.getDate() + 1);
  }
  
  // Convert IST target time to UTC for setTimeout
  const targetUTC = istToUTC(targetIST);
  const nowUTC = new Date();
  
  return targetUTC.getTime() - nowUTC.getTime();
}

/**
 * Schedule next sync at 12 PM IST
 */
function scheduleNextSync(client: GoogleDirectoryClient): void {
  const msUntilNext = getMsUntilNext12PMIST();
  const nowIST = getCurrentIST();
  const nextIST = new Date(nowIST);
  
  // Set target to today at 12:00 PM IST
  nextIST.setHours(SYNC_HOUR_IST, SYNC_MINUTE_IST, 0, 0);
  
  // If we've already passed 12 PM today, schedule for tomorrow
  if (nowIST >= nextIST) {
    nextIST.setDate(nextIST.getDate() + 1);
  }
  
  systemLog.info(`⏰ Next users sync scheduled for: ${formatForDisplay(nextIST)}`);
  
  setTimeout(() => {
    syncUsersFromGoogle(client)
      .then(count => {
        systemLog.info(`👥 Users sync completed at 12 PM IST. Upserted ${count} records`);
        // Schedule next sync for tomorrow at 12 PM IST
        scheduleNextSync(client);
      })
      .catch(err => {
        systemLog.error('users_sync_failed', { error: String(err?.message || err) });
        // Still schedule next sync even if this one failed
        scheduleNextSync(client);
      });
  }, msUntilNext);
}

export function startUsersSyncScheduler(client: GoogleDirectoryClient) {
  // Initial kick - sync immediately on startup
  syncUsersFromGoogle(client)
    .then(count => systemLog.info(`Initial users sync completed. Upserted ${count} records`))
    .catch(err => systemLog.error('initial_users_sync_failed', { error: String(err?.message || err) }));

  // Schedule recurring syncs at 12 PM IST every day
  scheduleNextSync(client);
  systemLog.info('⏱️  Users sync scheduler configured to run daily at 12:00 PM IST');
}

 