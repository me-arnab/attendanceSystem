import mongoose from 'mongoose';
import dns from 'dns';
import { ENV } from './env';

export const connectDB = async (): Promise<void> => {
  try {
    // On Windows, Node.js DNS resolver can fail SRV lookups for mongodb+srv URIs
    if (ENV.MONGODB_URI.startsWith('mongodb+srv://')) {
      try {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
      } catch {
        // Fall back to system resolver if setting servers is not permitted
      }
    }

    const conn = await mongoose.connect(ENV.MONGODB_URI, {
      dbName: 'attendance_saas',
    });
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error('[MongoDB] Connection error:', error);
    process.exit(1);
  }
};
