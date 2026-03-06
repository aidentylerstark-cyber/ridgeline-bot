import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Client } from 'discord.js';
import { processRegionUpdate } from '../features/region-monitoring.js';

const MAX_BODY_SIZE = 65_536; // 64 KB guard

// Simple in-memory rate limiter: max 60 requests per minute per IP
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) ?? [];
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

// Clean up stale rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap) {
    const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) rateLimitMap.delete(ip);
    else rateLimitMap.set(ip, recent);
  }
}, RATE_LIMIT_WINDOW_MS).unref();

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export function startRegionWebhookServer(client: Client): Server {
  const secret = process.env.REGION_MONITORING_SECRET;
  if (!secret) {
    console.warn('[Peaches] REGION_MONITORING_SECRET not set — region webhook will reject all requests');
  }

  const server = createServer(async (req, res) => {
    // Rate limit check (use x-forwarded-for behind reverse proxies like Railway)
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) ?? 'unknown';
    if (isRateLimited(clientIp)) {
      return json(res, 429, { error: 'Too many requests' });
    }

    // Health check
    if (req.method === 'GET' && req.url === '/health') {
      return json(res, 200, { status: 'ok' });
    }

    // Region status endpoint
    if (req.method === 'POST' && req.url === '/api/region-status') {
      // Auth check
      const authHeader = req.headers.authorization;
      if (!secret || authHeader !== `Bearer ${secret}`) {
        return json(res, 401, { error: 'Unauthorized' });
      }

      let body: string;
      try {
        body = await readBody(req);
      } catch {
        return json(res, 413, { error: 'Body too large' });
      }

      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        return json(res, 400, { error: 'Invalid JSON' });
      }

      // Validate required fields
      if (
        !payload ||
        typeof payload !== 'object' ||
        typeof (payload as Record<string, unknown>).region !== 'string'
      ) {
        return json(res, 400, { error: 'Missing required field: region' });
      }

      // Respond immediately, process async
      json(res, 200, { ok: true });

      // Fire-and-forget
      processRegionUpdate(client, payload as Record<string, unknown>).catch(err => {
        console.error('[Peaches] Error processing region update:', err);
      });
      return;
    }

    // Not found
    json(res, 404, { error: 'Not found' });
  });

  // Connection timeout to prevent slow-loris attacks
  server.timeout = 10_000; // 10 seconds
  server.keepAliveTimeout = 5_000;

  server.on('error', (err) => {
    console.error('[Peaches] Region webhook server error:', err);
  });

  const port = parseInt(process.env.PORT ?? '3001', 10);
  server.listen(port, () => {
    console.log(`[Peaches] Region webhook server listening on port ${port}`);
  });

  return server;
}
