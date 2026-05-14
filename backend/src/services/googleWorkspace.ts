import fs from 'fs';
import { UsersModel, AccountType } from '../models/Users';
import { google } from 'googleapis';
import { getCurrentIST, istToUTC, formatForDisplay } from '../utils/timezone';
import { systemLog } from '../logger/logger';
import { enqueueDevicePurgeJobs } from '../queues/devicePurgeQueue';
import { env } from '../env/env';
import { getProtectedEmailDomains } from '../utils/userSyncProtected';

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

export interface SyncUsersSummary {
  upserts: number;
  activatedRows: number;
  deactivatedCount: number;
  purgeJobsQueued: number;
  directoryUserCount: number;
}

export async function syncUsersFromGoogle(client: GoogleDirectoryClient): Promise<SyncUsersSummary> {
  const allRecords: Array<{
    email: string;
    name: string;
    createdAt: Date | string | null;
    account_type: AccountType;
  }> = [];

  let pageToken: string | undefined = undefined;
  do {
    const { users, nextPageToken } = await client.listUsers(pageToken);
    pageToken = nextPageToken;
    for (const u of users) {
      if (!(u.primaryEmail || '').includes('@')) continue;
      allRecords.push({
        email: u.primaryEmail as string,
        name: (u.name?.fullName || '').trim() || (u.primaryEmail as string),
        createdAt: u.creationTime || null,
        account_type: 'user' as AccountType,
      });
    }
  } while (pageToken);

  const directoryLower = new Set(allRecords.map((r) => r.email.toLowerCase()));
  const uniqueCanonical = [
    ...new Map(allRecords.map((r) => [r.email.toLowerCase(), r.email])).values(),
  ];

  const configuredDomains = (env.USER_SYNC_PROTECTED_EMAIL_DOMAINS || '').trim();
  const protectedDomains = getProtectedEmailDomains();
  if (!configuredDomains) {
    systemLog.info('user_sync_protected_domains_default', { domains: protectedDomains });
  } else {
    systemLog.info('user_sync_protected_domains_env', { domains: protectedDomains });
  }

  const upserts = await UsersModel.upsertMany(allRecords);
  const activatedRows = await UsersModel.activateUsersPresentInDirectory(uniqueCanonical);
  const { deactivated, skippedProtected } =
    await UsersModel.deactivateUsersMissingFromDirectory(directoryLower);

  const jobs = deactivated
    .filter((d) => d.deviceIds.length > 0)
    .map((d) => ({
      deviceIds: d.deviceIds,
      userEmail: d.email,
      gid: d.gid,
      source: 'directory_sync' as const,
    }));

  const purgeJobsQueued = await enqueueDevicePurgeJobs(jobs);

  systemLog.info('user_sync_directory_summary', {
    directory_user_count: directoryLower.size,
    upsert_rows_touched: upserts,
    activate_query_rows: activatedRows,
    deactivated_users: deactivated.length,
    skipped_protected_emails: skippedProtected,
    purge_jobs_queued: purgeJobsQueued,
    deactivated_detail: deactivated.map((d) => ({
      email: d.email,
      gid: d.gid,
      device_ids: d.deviceIds,
    })),
  });

  return {
    upserts,
    activatedRows,
    deactivatedCount: deactivated.length,
    purgeJobsQueued,
    directoryUserCount: directoryLower.size,
  };
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
      .then((summary) => {
        systemLog.info('users_sync_completed', {
          scheduleNote: '12 PM IST',
          ...summary,
        });
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
    .then((summary) => systemLog.info('initial_users_sync_completed', summary))
    .catch(err => systemLog.error('initial_users_sync_failed', { error: String(err?.message || err) }));

  // Schedule recurring syncs at 12 PM IST every day
  scheduleNextSync(client);
  systemLog.info('⏱️  Users sync scheduler configured to run daily at 12:00 PM IST');
}

 