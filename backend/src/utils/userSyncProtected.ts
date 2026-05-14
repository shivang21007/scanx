import { env } from '../env/env';

const DEFAULT_PROTECTED_DOMAINS = ['octro.com'];

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

export function isEmailProtectedFromSync(email: string): boolean {
  const lower = email.trim().toLowerCase();
  const at = lower.lastIndexOf('@');
  if (at < 0) return false;
  const domain = lower.slice(at + 1);
  const protectedDomains = getProtectedEmailDomains();
  return protectedDomains.some((p) => domain === p || domain.endsWith(`.${p}`));
}
