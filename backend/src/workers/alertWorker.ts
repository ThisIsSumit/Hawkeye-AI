import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initDb, disconnectDb } from '../lib/db.js';
import { closeRedis } from '../lib/redis.js';
import { queueService } from '../services/queue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env regardless of where the worker is started from.
dotenv.config({ path: path.join(__dirname, '../../.env') });

await initDb();
queueService.start();

console.log('[Worker] Alert worker is running');

async function shutdown(signal: string): Promise<void> {
	console.log(`\n[Worker] ${signal} received`);
	await queueService.stop();
	await closeRedis();
	await disconnectDb();
	console.log('[Worker] clean exit');
	process.exit(0);
}

process.on('SIGTERM', () => {
	void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
	void shutdown('SIGINT');
});
