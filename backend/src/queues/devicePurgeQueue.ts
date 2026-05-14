import redisClient, { connectRedis } from '../utils/redisClient';
import { env } from '../env/env';

export type DevicePurgeSource = 'directory_sync' | 'manual_admin';

export interface DevicePurgeJob {
  deviceIds: number[];
  userEmail: string;
  gid?: number;
  source: DevicePurgeSource;
}

function queueKey(): string {
  return env.DEVICE_PURGE_QUEUE_KEY || 'scanx:device_purge';
}

/**
 * Push purge jobs to Redis for the device-purge worker. Each job = one user batch of device IDs.
 */
export async function enqueueDevicePurgeJobs(jobs: DevicePurgeJob[]): Promise<number> {
  if (jobs.length === 0) return 0;
  if (!redisClient.isOpen) {
    await connectRedis();
  }
  let pushed = 0;
  for (const job of jobs) {
    if (!job.deviceIds?.length) continue;
    await redisClient.rPush(queueKey(), JSON.stringify(job));
    pushed++;
  }
  return pushed;
}
