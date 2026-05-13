import path from 'path';
import { randomBytes } from 'crypto';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import type { Request } from 'express';
import { env } from '../env/env';
import { formatLogTimestampIST } from '../utils/istLogTimestamp';

const istTimestamp = winston.format((info) => {
  (info as Record<string, unknown>).timestamp = formatLogTimestampIST(new Date());
  return info;
});

const logsDir = path.join(process.cwd(), 'logs');

const level = (env.LOG_LEVEL || process.env.LOG_LEVEL || 'info').toLowerCase();

/** 8 hex chars — enough for short-term log correlation */
export function generateShortRequestId(): string {
  return randomBytes(4).toString('hex');
}

/** Use first 8 hex digits from header (strip non-hex); if too short, assign a new id */
export function normalizeRequestIdHeader(raw: string): string {
  const hex = raw.replace(/[^a-fA-F0-9]/g, '');
  if (hex.length >= 8) return hex.slice(0, 8).toLowerCase();
  return generateShortRequestId();
}

function stripWinstonNoise(meta: Record<string, unknown>): Record<string, unknown> {
  const drop = new Set([
    'level',
    'message',
    'timestamp',
    'splat',
    Symbol.for('level'),
    Symbol.for('message'),
    Symbol.for('splat'),
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (drop.has(k as never)) continue;
    if (typeof k === 'string' && k.startsWith('Symbol(')) continue;
    if (typeof v === 'symbol') continue;
    out[k] = v;
  }
  return out;
}

const fileLineFormat = winston.format.printf((raw) => {
  const info = raw as Record<string, unknown>;
  const ts = String(info.timestamp ?? '');
  const lvl = String(info.level ?? '').toUpperCase();
  const client = info.client != null ? `[${info.client}]` : '';
  const rid = info.requestId != null ? `[${info.requestId}]` : '';
  const msg = String(info.message ?? '');
  const { timestamp: _t, level: _l, message: _m, client: _c, requestId: _r, ...rest } = info;
  const clean = stripWinstonNoise(rest as Record<string, unknown>);
  const tail = Object.keys(clean).length ? ` ${JSON.stringify(clean)}` : '';
  return `${ts} ${lvl} ${client}${rid} ${msg}${tail}`;
});

const fileFormat = winston.format.combine(
  istTimestamp(),
  winston.format.errors({ stack: true }),
  fileLineFormat
);

const transports: winston.transport[] = [
  new DailyRotateFile({
    dirname: logsDir,
    filename: 'scanx-%DATE%.log',
    datePattern: 'YYYY-MM',
    maxFiles: '24',
    format: fileFormat,
  }),
];

// Same plain text as the log file. `colorize()` breaks non-TTY consumers (`docker logs`).
transports.push(
  new winston.transports.Console({
    format: fileFormat,
  })
);

export const logger = winston.createLogger({
  level,
  transports,
});

/** DB, Redis, startup, schedulers — not tied to an HTTP request */
export const systemLog = logger.child({ client: 'system' });

export function getRequestLogger(req: Pick<Request, 'clientChannel' | 'requestId'>): winston.Logger {
  return logger.child({
    client: req.clientChannel ?? 'frontend',
    requestId: req.requestId ?? generateShortRequestId(),
  });
}
