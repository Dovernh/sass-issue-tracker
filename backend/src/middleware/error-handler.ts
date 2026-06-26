import type { ErrorRequestHandler } from 'express';

/**
 * Terminal error handler. Keeps the `{ detail }` JSON contract for unexpected
 * failures (e.g. DB errors surfaced via wrap()) instead of Express's HTML page.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ detail: 'Internal server error' });
};
