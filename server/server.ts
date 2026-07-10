import 'dotenv/config';
import app from './app.ts';
import connectDB from './config/db.ts';

// Fail fast on missing configuration instead of crashing mid-request later.
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `✖ Missing required environment variables: ${missing.join(', ')}\n` +
      '  Copy server/.env.example to server/.env and fill in the values.'
  );
  process.exit(1);
}

// Default 5001: macOS AirPlay Receiver listens on 5000 and hijacks requests.
const PORT = process.env.PORT || 5001;

const start = async () => {
  await connectDB(process.env.MONGO_URI as string);

  const server = app.listen(PORT, () => {
    console.log(`▲ NordCart API running on http://localhost:${PORT} (${process.env.NODE_ENV})`);
  });

  // A rejection that escapes all handlers means unknown state — log and shut down cleanly.
  process.on('unhandledRejection', (err) => {
    console.error('✖ Unhandled rejection:', err);
    server.close(() => process.exit(1));
  });
};

start();
