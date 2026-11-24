import { createApp } from './app';
import { connectDB } from './config/db';
import { ENV } from './config/env';

const startServer = async () => {
  await connectDB();

  const app = createApp();

  app.listen(ENV.PORT, () => {
    console.log(`[Server] Enterprise Attendance SaaS API running on port ${ENV.PORT} (${ENV.NODE_ENV})`);
    console.log(`[Server] Health check available at: http://localhost:${ENV.PORT}/api/health`);
  });
};

startServer().catch((err) => {
  console.error('[Server] Fatal bootstrap error:', err);
  process.exit(1);
});
