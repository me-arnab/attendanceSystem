import http from 'http';
import { createApp } from './app';
import { connectDB } from './config/db';
import { ENV } from './config/env';
import { initSocketIO } from './socket';

const startServer = async () => {
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  initSocketIO(server, ENV.FRONTEND_URL);

  server.listen(ENV.PORT, () => {
    console.log(`[Server] Enterprise Attendance SaaS API running on port ${ENV.PORT} (${ENV.NODE_ENV})`);
    console.log(`[Server] Health check available at: http://localhost:${ENV.PORT}/api/health`);
    console.log(`[Server] Socket.IO server initialized`);
  });
};

startServer().catch((err) => {
  console.error('[Server] Fatal bootstrap error:', err);
  process.exit(1);
});
