import Transport from 'winston-transport';
import { env } from '../env/env';
import { toStrictRecord } from './logSchema';

interface OpenObserveTransportOptions extends Transport.TransportStreamOptions {
  endpoint: string;
  org: string;
  stream: string;
  authHeader: string;
  batchSize?: number;
  flushIntervalMs?: number;
  maxQueue?: number;
}

/**
 * Ships strict-schema records to OpenObserve's `_json` ingest endpoint.
 *
 * Posts directly rather than through the OTel collector: OTLP flattens
 * attribute names (requestId became `requestid`, statusCode `statuscode`),
 * and controlling the exact column names is the whole point of the strict
 * schema. Metrics still go through the collector, which is the only way to
 * reach docker_stats.
 *
 * Records are batched, never sent one connection per line. The queue is
 * bounded and drops oldest-first: logging must not be able to stall request
 * handling or exhaust memory when OpenObserve is slow or down.
 */
export class OpenObserveTransport extends Transport {
  private readonly endpoint: string;
  private readonly authHeader: string;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxQueue: number;

  private queue: Record<string, unknown>[] = [];
  private timer: NodeJS.Timeout | undefined;
  private inFlight = false;
  private dropped = 0;

  constructor(opts: OpenObserveTransportOptions) {
    super(opts);
    const base = opts.endpoint.replace(/\/+$/, '');
    this.endpoint = `${base}/api/${opts.org}/${opts.stream}/_json`;
    this.authHeader = opts.authHeader;
    this.batchSize = opts.batchSize ?? 200;
    this.flushIntervalMs = opts.flushIntervalMs ?? 5_000;
    this.maxQueue = opts.maxQueue ?? 10_000;
  }

  log(info: unknown, callback: () => void): void {
    setImmediate(() => this.emit('logged', info));

    const rec = toStrictRecord(info as Record<string, unknown>) as unknown as Record<string, unknown>;
    // OpenObserve reads _timestamp in microseconds.
    rec._timestamp = Date.now() * 1000;

    if (this.queue.length >= this.maxQueue) {
      this.queue.shift();
      this.dropped += 1;
    }
    this.queue.push(rec);

    if (this.queue.length >= this.batchSize) {
      void this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => void this.flush(), this.flushIntervalMs);
      this.timer.unref?.();
    }

    callback();
  }

  hasPending(): boolean {
    return this.queue.length > 0;
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (this.inFlight || this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.batchSize);
    this.inFlight = true;
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: this.authHeader },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        // Never log through winston here: that would recurse into this transport.
        process.stderr.write(`[openobserve-transport] ingest failed: HTTP ${res.status}\n`);
      }
      if (this.dropped > 0) {
        process.stderr.write(`[openobserve-transport] dropped ${this.dropped} records (queue full)\n`);
        this.dropped = 0;
      }
    } catch (err) {
      process.stderr.write(`[openobserve-transport] ingest error: ${(err as Error).message}\n`);
    } finally {
      this.inFlight = false;
      if (this.queue.length > 0 && !this.timer) {
        this.timer = setTimeout(() => void this.flush(), this.flushIntervalMs);
        this.timer.unref?.();
      }
    }
  }
}

let instance: OpenObserveTransport | undefined;

/** Returns undefined when disabled or unconfigured, so dev boxes behave as before. */
export function createOpenObserveTransport(): Transport | undefined {
  if (!env.OO_LOGS_ENABLED) return undefined;
  if (!env.OO_ENDPOINT || !env.OO_AUTH_HEADER) return undefined;

  instance = new OpenObserveTransport({
    endpoint: env.OO_ENDPOINT,
    org: env.OO_ORG || 'default',
    stream: env.OO_STREAM || 'scanx_backend_logs',
    authHeader: env.OO_AUTH_HEADER,
  });
  return instance;
}

/** Drain buffered records so a graceful shutdown does not lose the last batch. */
export async function shutdownOpenObserveLogs(): Promise<void> {
  if (!instance) return;
  try {
    // Bounded: a persistently failing sink must not hold the process open.
    for (let i = 0; i < 20 && instance.hasPending(); i += 1) {
      await instance.flush();
    }
  } catch {
    // Best effort; telemetry must never stall process exit.
  } finally {
    instance = undefined;
  }
}
