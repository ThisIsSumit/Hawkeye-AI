import { Redis } from 'ioredis';

let redisClient: Redis | null = null;

function createRedisClient(): Redis | null {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    client.on('connect', () => console.log('[Redis] connected'));
    client.on('error',   (e: Error) => console.warn('[Redis] error:', e.message));
    return client;
  } catch {
    console.warn('[Redis] could not create client — queue features disabled');
    return null;
  }
}

export function getRedis(): Redis | null {
  if (!redisClient) redisClient = createRedisClient();
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) { await redisClient.quit(); redisClient = null; }
}
