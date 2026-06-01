import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Load .env from the backend root (one level up from src)
dotenv.config({ path: path.join(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';

import { router }      from './routes/api.js';
import { ingestRouter } from './routes/ingest.js';
import { authRouter }  from './routes/auth.js';
import { settingsRouter } from './routes/settings.js';
import { simulator }   from './services/simulator.js';
import { queueService } from './services/queue.js';
import { closeRedis }  from './lib/redis.js';
import { initDb, disconnectDb } from './lib/db.js';
import { requestLogger, notFound, errorHandler } from './middleware/index.js';

const PORT       = Number.parseInt(process.env.PORT ?? '4000', 10);
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';
const ENABLE_SIMULATOR = process.env.ENABLE_SIMULATOR === 'true';

const app = express();
app.disable('x-powered-by');

app.use(cors({
  origin:      CLIENT_URL,
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(requestLogger);

app.use('/api/auth', authRouter);
app.use('/api', ingestRouter);  // /api/ingest handler
app.use('/api', router);        // other API handlers
app.use('/api', settingsRouter); // settings + tokens handlers
app.use(notFound);
app.use(errorHandler);

await initDb();
const server = app.listen(PORT, () => {
  console.log(`\n🦅  HawkEye AI — all systems online`);
  console.log(`   API:     http://localhost:${PORT}/api`);
  console.log(`   Stream:  http://localhost:${PORT}/api/stream`);
  console.log(`   Health:  http://localhost:${PORT}/api/health`);
  console.log(`   Auth:    http://localhost:${PORT}/api/auth/login`);
  console.log(`   AI mode: ${process.env.OPENROUTER_API_KEY ? '✅ OpenRouter live' : '⚠️  mock (add OPENROUTER_API_KEY)'}`);
  console.log(`   DB mode: ${process.env.DATABASE_URL      ? '✅ PostgreSQL'  : '⚠️  in-memory (add DATABASE_URL)'}\n`);

  if (ENABLE_SIMULATOR) {
    simulator.start();
  }
  queueService.start();
});

async function shutdown(signal: string) {
  console.log(`\n[SHUTDOWN] ${signal} received`);
  if (ENABLE_SIMULATOR) {
    simulator.stop();
  }
  await queueService.stop();
  await closeRedis();
  await disconnectDb();
  server.close(() => { console.log('[SHUTDOWN] clean exit'); process.exit(0); });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

export default app;
