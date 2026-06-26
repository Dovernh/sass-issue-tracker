import express, { type Express } from 'express';
import cors from 'cors';
import * as Sentry from '@sentry/node';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { meRouter } from './routes/me.js';
import { issuesRouter } from './routes/issues.js';
import { membersRouter } from './routes/members.js';
import { platformRouter } from './routes/platform.js';
import { prioritiesRouter } from './routes/priorities.js';
import { categoriesRouter } from './routes/categories.js';
import { languagesRouter } from './routes/languages.js';
import { rolesRouter } from './routes/roles.js';
import { errorHandler } from './middleware/error-handler.js';
import { buildOpenApiDocument } from './openapi.js';

export function createApp(): Express {
  const app = express();

  app.use(express.json({ limit: '2mb' }));
  app.use(
    cors({
      origin: config.FRONTEND_URL,
      allowedHeaders: ['Authorization', 'Content-Type'],
    }),
  );

  // Machine-readable API spec; the Angular client is generated from this.
  app.get('/openapi.json', (_req, res) => res.json(buildOpenApiDocument()));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/me', meRouter);
  app.use('/api/issues', issuesRouter);
  app.use('/api/members', membersRouter);
  app.use('/api/platform', platformRouter);
  app.use('/api/priorities', prioritiesRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/languages', languagesRouter);
  app.use('/api/roles', rolesRouter);

  if (Sentry.isInitialized()) {
    Sentry.setupExpressErrorHandler(app);
  }

  app.use(errorHandler);

  return app;
}
