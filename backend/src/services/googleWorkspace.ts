import fs from 'fs';
import path from 'path';
import { UsersModel, AccountType } from '../models/Users';
import { google } from 'googleapis';

// Hardcoded refresh interval: 24 hours (in milliseconds)
export const USERS_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

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

export function startUsersSyncScheduler(client: GoogleDirectoryClient) {
  // Initial kick
  syncUsersFromGoogle(client)
    .then(count => console.log(`👥 Users sync completed. Upserted ${count} records`))
    .catch(err => console.error('Users sync failed:', err?.message || err));

  // Interval schedule
  setInterval(() => {
    syncUsersFromGoogle(client)
      .then(count => console.log(`👥 Users sync completed. Upserted ${count} records`))
      .catch(err => console.error('Users sync failed:', err?.message || err));
  }, USERS_SYNC_INTERVAL_MS);
}

 