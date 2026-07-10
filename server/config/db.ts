import mongoose from 'mongoose';

/**
 * Connect to MongoDB. Called once at startup; Mongoose handles pooling
 * and reconnection from there — we just log state changes for observability.
 */
const connectDB = async (uri: string) => {
  mongoose.connection.on('disconnected', () => console.warn('⚠ MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => console.log('✔ MongoDB reconnected'));

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000, // fail in 10s instead of hanging 30s on a bad URI
    });
    console.log(`✔ MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    console.error(`✖ MongoDB connection failed: ${err instanceof Error ? err.message : err}`);
    console.error('  Check MONGO_URI in server/.env (and Atlas IP allowlist).');
    process.exit(1);
  }
};

export default connectDB;
