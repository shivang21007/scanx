export {};

declare global {
  namespace Express {
    interface Request {
      /** Dashboard (frontend) vs ScanX agent */
      clientChannel?: 'frontend' | 'agent' | 'system';
      /** Correlates logs for one HTTP request */
      requestId?: string;
      /** Set by `auth` after JWT verify — for audit / http_request logs */
      authenticatedEmail?: string;
    }
  }
}
