import { AccountType } from '../models/Users';
import { env } from '../env/env';

export interface DirectoryUserForAccountType {
  primaryEmail?: string;
  orgUnitPath?: string;
}

/**
 * Infer ScanX account_type for a **new** directory row only.
 * Google has no native user/service flag; optional OU substring via env.
 */
export function inferAccountTypeFromDirectoryUser(u: DirectoryUserForAccountType): AccountType {
  const marker = (env.GOOGLE_SERVICE_ORG_UNIT_PATH || '').trim().toLowerCase();
  if (marker) {
    const ou = (u.orgUnitPath || '').toLowerCase();
    if (ou.includes(marker)) return 'service';
  }
  return 'user';
}
