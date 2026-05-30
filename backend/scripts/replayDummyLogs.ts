import fs from 'node:fs/promises';
import path from 'node:path';

type IngestEvent = Record<string, unknown>;

interface ReplayOptions {
  filePath: string;
  endpoint: string;
  token: string;
  dryRun: boolean;
}

interface ReplayStats {
  sent: number;
  accepted: number;
  ignored: number;
  unauthorized: number;
  failed: number;
}

function parseArgs(argv: string[]): ReplayOptions {
  const options: ReplayOptions = {
    filePath: 'tests/fixtures/dummy-logs.jsonl',
    endpoint: process.env.INGEST_URL ?? 'http://localhost:4000/api/ingest',
    token: process.env.INGEST_API_TOKEN ?? '',
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--file' && argv[i + 1]) {
      options.filePath = argv[i + 1];
      i += 1;
    } else if (arg === '--url' && argv[i + 1]) {
      options.endpoint = argv[i + 1];
      i += 1;
    } else if (arg === '--token' && argv[i + 1]) {
      options.token = argv[i + 1];
      i += 1;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  console.log('Replay dummy logs to HawkEye ingest endpoint');
  console.log('');
  console.log('Usage: npm run ingest:replay -- [options]');
  console.log('');
  console.log('Options:');
  console.log('  --file <path>   JSONL file path (default: tests/fixtures/dummy-logs.jsonl)');
  console.log('  --url <url>     Ingest endpoint (default: http://localhost:4000/api/ingest)');
  console.log('  --token <token> Ingest token header value');
  console.log('  --dry-run       Parse and print events without sending HTTP requests');
  console.log('  -h, --help      Show this help');
}

async function readJsonLines(filePath: string): Promise<IngestEvent[]> {
  const absolutePath = path.resolve(filePath);
  const content = await fs.readFile(absolutePath, 'utf8');

  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      try {
        return JSON.parse(line) as IngestEvent;
      } catch (err) {
        throw new Error(`Invalid JSON at line ${index + 1}: ${String(err)}`);
      }
    });
}

async function postEvent(endpoint: string, token: string, payload: IngestEvent): Promise<number> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['x-ingest-token'] = token;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  return response.status;
}

async function replay(options: ReplayOptions): Promise<void> {
  const events = await readJsonLines(options.filePath);

  if (!options.dryRun && !options.token) {
    console.warn('[WARN] No token provided. If INGEST_API_TOKEN is enabled, requests will return 401.');
  }

  const stats: ReplayStats = {
    sent: 0,
    accepted: 0,
    ignored: 0,
    unauthorized: 0,
    failed: 0,
  };

  console.log(`[Replay] Loaded ${events.length} events from ${options.filePath}`);
  console.log(`[Replay] Target endpoint: ${options.endpoint}`);
  console.log(`[Replay] Mode: ${options.dryRun ? 'dry-run' : 'live'}`);

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    const eventId = i + 1;

    if (options.dryRun) {
      console.log(`[DryRun] #${eventId} source=${String(event.source ?? 'unknown')} path=${String(event.path ?? '-')}`);
      continue;
    }

    try {
      const status = await postEvent(options.endpoint, options.token, event);
      stats.sent += 1;

      if (status === 201) stats.accepted += 1;
      else if (status === 204) stats.ignored += 1;
      else if (status === 401) stats.unauthorized += 1;
      else stats.failed += 1;

      console.log(`[Replay] #${eventId} -> HTTP ${status}`);
    } catch (err) {
      stats.sent += 1;
      stats.failed += 1;
      console.error(`[Replay] #${eventId} failed: ${String(err)}`);
    }
  }

  if (options.dryRun) {
    console.log(`[Replay] Dry run complete. Events parsed: ${events.length}`);
    return;
  }

  console.log('[Replay] Complete');
  console.log(`  Sent: ${stats.sent}`);
  console.log(`  Accepted (201): ${stats.accepted}`);
  console.log(`  Ignored (204): ${stats.ignored}`);
  console.log(`  Unauthorized (401): ${stats.unauthorized}`);
  console.log(`  Failed: ${stats.failed}`);
}

const options = parseArgs(process.argv.slice(2));
replay(options).catch((err) => {
  console.error('[Replay] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
