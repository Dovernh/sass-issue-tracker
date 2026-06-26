import './instrument.js'; // must be first — initializes Sentry before other imports
import { config } from './config.js';
import { runMigrations } from './db/index.js';
import { createApp } from './app.js';

const start = async (): Promise<void> => {
  // Applies migrations and seeds global reference data (languages).
  await runMigrations();

  const app = createApp();

  app.listen(config.PORT, () => {
    console.log(`Backend listening on http://localhost:${config.PORT}`);
    console.log(`Allowing frontend origin: ${config.FRONTEND_URL}`);
  });
};

start().catch((err) => {
  console.error('Failed to start backend:', err);
  process.exit(1);
});
