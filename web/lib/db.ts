import mongoose from 'mongoose';

/**
 * Cached mongoose connection. Serverless functions and dev HMR both re-run
 * module code; caching the connection (and the in-flight promise) on
 * globalThis prevents a new connection per invocation / hot reload.
 */
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalWithCache = globalThis as typeof globalThis & { mongooseCache?: MongooseCache };

const cached = globalWithCache.mongooseCache ?? (globalWithCache.mongooseCache = { conn: null, promise: null });

export default async function dbConnect() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not set');
    cached.promise = mongoose.connect(uri);
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Failed connects must not poison the cache for the next request.
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}
