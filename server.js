import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');
const port = Number(process.env.PORT ?? 8787);
const maxTextBytes = 200_000;

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const clients = new Set();
let text = '';

function broadcast() {
  const frame = `data: ${JSON.stringify({ text })}\n\n`;
  for (const res of clients) res.write(frame);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxTextBytes) {
        req.destroy();
        reject(new Error('too_large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('not_found');
}

async function sendAsset(pathname, res) {
  const relative = normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, '');
  const target = join(dist, relative);
  if (relative && target !== dist && !target.startsWith(dist + sep)) {
    notFound(res);
    return;
  }

  let body;
  try {
    body = await readFile(target);
  } catch {
    notFound(res);
    return;
  }

  const type = mimeTypes[extname(target)] ?? 'application/octet-stream';
  const cache = target === join(dist, 'index.html') ? 'no-store' : 'public, max-age=31536000, immutable';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache }).end(body);
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`data: ${JSON.stringify({ text })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (req.method === 'POST' && req.url === '/api/text') {
    try {
      text = await readBody(req);
    } catch {
      res.writeHead(413, { 'Content-Type': 'text/plain; charset=utf-8' }).end('too_large');
      return;
    }
    broadcast();
    res.writeHead(204).end();
    return;
  }

  if (req.method === 'GET') {
    await sendAsset(req.url === '/' ? '/index.html' : req.url.split('?')[0], res);
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' }).end('method_not_allowed');
});

server.listen(port, '0.0.0.0', () => {
  console.log(`ScratchPad listening on http://0.0.0.0:${port}`);
});
