import type { AuthUser } from './auth.js';

// Make the verified identity attached by getCurrentUser available on req.auth.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export {};
