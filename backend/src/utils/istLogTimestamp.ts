/** UTC+5:30 — aligned with `timezone.ts` IST handling for this service */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * Format instant as India Standard Time for log lines: `YYYY-MM-DDTHH:mm:ss.SSS IST`
 * (Uses UTC getters on a shifted Date so output is IST wall clock without relying on host TZ.)
 */
export function formatLogTimestampIST(d: Date = new Date()): string {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const mo = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  const h = String(shifted.getUTCHours()).padStart(2, '0');
  const mi = String(shifted.getUTCMinutes()).padStart(2, '0');
  const s = String(shifted.getUTCSeconds()).padStart(2, '0');
  const frac = String(shifted.getUTCMilliseconds()).padStart(3, '0');
  return `${y}-${mo}-${day}T${h}:${mi}:${s}.${frac} IST`;
}
