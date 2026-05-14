import type { Request, Response, NextFunction } from 'express';
import { logger, generateShortRequestId, normalizeRequestIdHeader } from '../logger/logger';

const AGENT_PATH_PREFIXES = ['/api/devices/agent'];

function isAgentUserAgent(req: Request): boolean {
  const ua = String(req.headers['user-agent'] ?? '');
  return /scanx\//i.test(ua);
}

/**
 * Classify caller: ScanX agent vs dashboard/API clients.
 * Agent uses: POST /api/devices/agent/*, POST interval-confirm, GET update-check, and often scanx/* User-Agent.
 */
export function resolveClientChannel(req: Request): 'frontend' | 'agent' {
  const pathname = (req.originalUrl || req.url || '').split('?')[0];
  if (AGENT_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return 'agent';
  }
  if (pathname.startsWith('/api/updates/update-check')) {
    return 'agent';
  }
  if (pathname === '/api/health' || pathname === '/' || pathname === '/api') {
    if (isAgentUserAgent(req)) return 'agent';
  }
  return 'frontend';
}

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  req.requestId =
    typeof incoming === 'string' && incoming.trim()
      ? normalizeRequestIdHeader(incoming.trim())
      : generateShortRequestId();
  req.clientChannel = resolveClientChannel(req);

  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const email = req.authenticatedEmail?.trim();
    logger.info('http_request', {
      client: req.clientChannel,
      requestId: req.requestId,
      ...(email ? { user: email } : {}),
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs,
      contentLength: res.getHeader('content-length'),
    });
  });

  next();
}
