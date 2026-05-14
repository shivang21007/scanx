import 'dotenv/config';
import { createClient } from 'redis';
import { env } from '../env/env';
import { systemLog } from '../logger/logger';
import { connectDB } from '../db/connection';
import { DeviceModel } from '../models/Device';

const TABLES_PURGED = [
  'devices',
  'device_summary',
  'system_info',
  'password_manager_info',
  'screen_lock_info',
  'antivirus_info',
  'disk_encryption_info',
  'apps_info',
  'device_interval_requests',
] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function queueKey(): string {
  return env.DEVICE_PURGE_QUEUE_KEY || 'scanx:device_purge';
}

function pollMs(): number {
  const n = parseInt(env.DEVICE_PURGE_WORKER_POLL_MS || '750', 10);
  return Number.isFinite(n) && n >= 100 ? n : 750;
}

function deviceBatch(): number {
  const n = parseInt(env.DEVICE_PURGE_DEVICE_BATCH || '5', 10);
  return Number.isFinite(n) && n >= 1 ? n : 5;
}

async function run(): Promise<void> {
  await connectDB();

  const workerClient = createClient({
    socket: {
      host: env.REDIS_HOST || 'localhost',
      port: parseInt(env.REDIS_PORT || '6379', 10),
    },
    password: env.REDIS_PASSWORD && env.REDIS_PASSWORD.trim() !== '' ? env.REDIS_PASSWORD : undefined,
  });

  workerClient.on('error', (err: Error) => {
    systemLog.error('purge_worker_redis_error', { error: err.message });
  });

  await workerClient.connect();
  systemLog.info('device_purge_worker_started', { queue: queueKey(), pollMs: pollMs(), batch: deviceBatch() });

  const key = queueKey();
  const batchSize = deviceBatch();
  const wait = pollMs();

  for (;;) {
    const raw = await workerClient.rPop(key);
    if (!raw) {
      await sleep(wait);
      continue;
    }

    let job: { deviceIds: number[]; userEmail: string; gid?: number; source: string };
    try {
      job = JSON.parse(String(raw));
    } catch {
      systemLog.error('device_purge_worker_invalid_job', { raw: String(raw).slice(0, 200) });
      continue;
    }

    const ids = Array.isArray(job.deviceIds) ? job.deviceIds.filter((n) => typeof n === 'number') : [];
    if (!ids.length) {
      systemLog.warn('device_purge_worker_empty_job', { userEmail: job.userEmail, source: job.source });
      continue;
    }

    systemLog.info('device_purge_job_start', {
      userEmail: job.userEmail,
      gid: job.gid,
      source: job.source,
      deviceCount: ids.length,
      tables: TABLES_PURGED,
    });

    for (let i = 0; i < ids.length; i += batchSize) {
      const chunk = ids.slice(i, i + batchSize);
      for (const deviceId of chunk) {
        try {
          await DeviceModel.deleteById(deviceId);
          systemLog.info('device_purge_device_done', {
            deviceId,
            userEmail: job.userEmail,
            source: job.source,
            tables: [...TABLES_PURGED],
          });
        } catch (e: any) {
          systemLog.error('device_purge_device_failed', {
            deviceId,
            userEmail: job.userEmail,
            error: e?.message || String(e),
          });
        }
      }
      if (i + batchSize < ids.length) {
        await sleep(0);
      }
    }

    systemLog.info('device_purge_job_complete', {
      userEmail: job.userEmail,
      gid: job.gid,
      source: job.source,
      deviceCount: ids.length,
    });
  }
}

run().catch((e) => {
  systemLog.error('device_purge_worker_fatal', { error: String(e) });
  process.exit(1);
});
