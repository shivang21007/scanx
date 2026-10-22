import { env } from '../env/env';

const DEFAULT_PROTECTED_DOMAINS = ['octro.com'];
const DEFAULT_PROTECTED_LOCAL_PREFIXES = ['server.'];

/**
 * Domains that must never be marked inactive by directory sync (comma-separated in env).
 * If `USER_SYNC_PROTECTED_EMAIL_DOMAINS` is unset or empty, defaults to `octro.com` only.
 */
export function getProtectedEmailDomains(): string[] {
  const raw = (env.USER_SYNC_PROTECTED_EMAIL_DOMAINS || '').trim();
  if (!raw) {
    return [...DEFAULT_PROTECTED_DOMAINS];
  }
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
}

/**
 * Username (local-part) prefixes that must never be marked inactive by directory
 * sync, regardless of domain (comma-separated in env). These are service/robot
 * accounts such as `server.builds@octrotalk.com` that are not real directory users.
 * If `USER_SYNC_PROTECTED_LOCAL_PREFIXES` is unset or empty, defaults to `server.`.
 */
export function getProtectedLocalPrefixes(): string[] {
  const raw = (env.USER_SYNC_PROTECTED_LOCAL_PREFIXES || '').trim();
  if (!raw) {
    return [...DEFAULT_PROTECTED_LOCAL_PREFIXES];
  }
  return raw
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailProtectedFromSync(email: string): boolean {
  const lower = email.trim().toLowerCase();
  const at = lower.lastIndexOf('@');
  if (at < 0) return false;

  const localPart = lower.slice(0, at);
  if (getProtectedLocalPrefixes().some((p) => localPart.startsWith(p))) {
    return true;
  }

  const domain = lower.slice(at + 1);
  const protectedDomains = getProtectedEmailDomains();
  return protectedDomains.some((p) => domain === p || domain.endsWith(`.${p}`));
}
