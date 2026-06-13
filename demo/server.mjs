import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 35002);
const REMOTE_API_BASE = 'http://localhost:35001';
const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

const server = http.createServer(async (request, response) => {
  try {
    if (request.url?.startsWith('/api/')) {
      await proxyApi(request, response);
      return;
    }

    await serveStatic(request, response);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ ok: false, error: { message: error?.message || 'internal server error' } }));
  }
});

server.listen(PORT, () => {
  console.log(`Blog demo: http://localhost:${PORT}`);
});

async function serveStatic(request, response) {
  const url = new URL(request.url || '/', `http://localhost:${PORT}`);
  const rawPathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const safePath = path.normalize(rawPathname).replace(/^(\.\.(\/+|\\+|$))+/, '');
  const filePath = path.join(ROOT_DIR, safePath);

  if (!filePath.startsWith(ROOT_DIR)) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    response.end(content);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}

async function proxyApi(request, response) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);

  const upstream = await fetch(`${REMOTE_API_BASE}${request.url}`, {
    method: request.method,
    headers: filterProxyHeaders(request.headers),
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : Buffer.concat(chunks)
  });

  const headers = Object.fromEntries(upstream.headers.entries());
  delete headers['content-encoding'];
  delete headers['content-length'];
  headers['access-control-allow-origin'] = '*';

  response.writeHead(upstream.status, headers);
  response.end(Buffer.from(await upstream.arrayBuffer()));
}

function filterProxyHeaders(headers) {
  const nextHeaders = { ...headers };
  delete nextHeaders.host;
  delete nextHeaders.connection;
  delete nextHeaders['content-length'];
  return nextHeaders;
}