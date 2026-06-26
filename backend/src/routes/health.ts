import { Router } from 'express';

export const healthRouter = Router();

// Public health check.
healthRouter.get('/', (_req, res) => {
  res.json({ status: 'ok' });
});
