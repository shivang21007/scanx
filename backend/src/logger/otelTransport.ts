import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';
import type Transport from 'winston-transport';
import { env } from '../env/env';

let provider: LoggerProvider | undefined;

/**
 * Winston transport that ships log records to OpenObserve over OTLP.
 *
 * This is purely an adapter swap: call sites keep using `logger`/`systemLog`
 * exactly as before, and the same records additionally leave the process as
 * OTLP. Returns undefined when disabled or unconfigured, so a dev machine with
 * no collector running behaves exactly as it did before.
 */
export function createOtelTransport(): Transport | undefined {
  if (!env.OTEL_LOGS_ENABLED) return undefined;

  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return undefined;

  const exporter = new OTLPLogExporter({
    url: `${endpoint.replace(/\/+$/, '')}/v1/logs`,
    // A slow or down collector must never block request handling.
    timeoutMillis: 10_000,
  });

  provider = new LoggerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME || 'scanx-backend',
      [ATTR_SERVICE_VERSION]: env.SCANX_VERSION || 'unknown',
      'deployment.environment.name': env.NODE_ENV || 'development',
    }),
    processors: [
      new BatchLogRecordProcessor({
        exporter,
        maxQueueSize: 4096,
        scheduledDelayMillis: 5_000,
      }),
    ],
  });

  logs.setGlobalLoggerProvider(provider);

  return new OpenTelemetryTransportV3();
}

/** Flush buffered records so a graceful shutdown does not drop the last batch. */
export async function shutdownOtelLogs(): Promise<void> {
  if (!provider) return;
  try {
    await provider.shutdown();
  } catch {
    // Shutdown is best-effort; never let telemetry stall process exit.
  } finally {
    logs.disable();
    provider = undefined;
  }
}
