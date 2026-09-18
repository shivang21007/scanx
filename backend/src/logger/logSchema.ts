import winston from 'winston';
import { formatLogTimestampIST } from '../utils/istLogTimestamp';

/**
 * Fixed column set for the OpenObserve `scanx_backend_logs` stream.
 *
 * Call sites across the codebase name the same thing four different ways
 * (`user`, `userEmail`, `user_email`, `email`), and each event carries an
 * ad-hoc subset of 51 metadata keys. That produced a stream with no usable
 * shape. This normalises every record to the vocabulary below; anything not
 * covered is preserved verbatim as JSON in `details`, so no information is
 * lost relative to the console line.
 *
 * Only the OTLP transport uses this. Console and file output are untouched.
 */
export interface StrictLogRecord {
  ts_ist: string;
  level: string;
  event: string;
  client: string;
  request_id: string;
  outcome: 'success' | 'failure';
  actor_email?: string;
  actor_admin_id?: string;
  device_serial?: string;
  device_count?: number;
  http_method?: string;
  http_path?: string;
  http_status?: number;
  http_duration_ms?: number;
  http_bytes?: number;
  error_message?: string;
  error_stack?: string;
  error_code?: string;
  details: string;
}

/** Aliases collapsed into one canonical column. */
const ACTOR_EMAIL_KEYS = ['user', 'userEmail', 'user_email', 'email'] as const;
const CONSUMED = new Set<string>([
  ...ACTOR_EMAIL_KEYS,
  'level', 'message', 'timestamp', 'splat', 'client', 'requestId',
  'adminId', 'serial_no', 'deviceCount', 'count',
  'method', 'path', 'statusCode', 'durationMs', 'contentLength',
  'error', 'stack', 'code',
]);

function str(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = typeof v === 'string' ? v : String(v);
  return s.trim() === '' ? undefined : s;
}

function num(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** error/warn levels, `*_failed`-style event names, and 4xx/5xx are failures. */
function resolveOutcome(level: string, event: string, httpStatus?: number): 'success' | 'failure' {
  if (level === 'error' || level === 'warn') return 'failure';
  if (httpStatus !== undefined && httpStatus >= 400) return 'failure';
  return /(_failed|_error|_exceeded|_blocked|_not_found|_invalid)$/.test(event) ? 'failure' : 'success';
}

function firstDefined(meta: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const k of keys) {
    const v = str(meta[k]);
    if (v !== undefined) return v;
  }
  return undefined;
}

export function toStrictRecord(info: Record<string, unknown>): StrictLogRecord {
  const level = String(info.level ?? 'info');
  const event = String(info.message ?? '');

  const details: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(info)) {
    if (CONSUMED.has(k)) continue;
    if (typeof k !== 'string' || k.startsWith('Symbol(')) continue;
    if (typeof v === 'symbol' || typeof v === 'function') continue;
    details[k] = v;
  }

  const httpStatus = num(info.statusCode);

  const rec: StrictLogRecord = {
    ts_ist: formatLogTimestampIST(new Date()),
    level,
    event,
    client: str(info.client) ?? 'system',
    request_id: str(info.requestId) ?? '',
    outcome: resolveOutcome(level, event, httpStatus),
    details: JSON.stringify(details),
  };

  const assign = <K extends keyof StrictLogRecord>(k: K, v: StrictLogRecord[K] | undefined) => {
    if (v !== undefined) rec[k] = v;
  };

  assign('actor_email', firstDefined(info, ACTOR_EMAIL_KEYS));
  assign('actor_admin_id', str(info.adminId));
  assign('device_serial', str(info.serial_no));
  assign('device_count', num(info.deviceCount ?? info.count));
  assign('http_method', str(info.method));
  assign('http_path', str(info.path));
  assign('http_status', httpStatus);
  assign('http_duration_ms', num(info.durationMs));
  assign('http_bytes', num(info.contentLength));
  assign('error_message', str(info.error));
  assign('error_stack', str(info.stack));
  assign('error_code', str(info.code));

  return rec;
}

/**
 * Winston format that rewrites a record into the strict shape. `message` is
 * kept so the OTLP body stays the event name; everything else becomes a
 * normalised attribute.
 */
export const strictSchemaFormat = winston.format((info) => {
  const rec = toStrictRecord(info as Record<string, unknown>);
  for (const k of Object.keys(info)) {
    if (k === 'level' || k === 'message') continue;
    delete (info as Record<string, unknown>)[k];
  }
  Object.assign(info, rec);
  (info as Record<string, unknown>).message = rec.event;
  return info;
});
