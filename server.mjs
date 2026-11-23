import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handleZapisy from './api/zapisy.js';

if (!process.env.LOCAL_MODE) process.env.LOCAL_MODE = '1';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/api/zapisy') return await handleZapisy(req, res);
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405;
      res.end('Niedozwolona metoda.');
      return;
    }

    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filePath = path.normalize(path.join(root, pathname));
    const relative = path.relative(root, filePath);
    if (
      relative.startsWith('..') ||
      path.isAbsolute(relative) ||
      relative.split(path.sep).some((part) => part.startsWith('.'))
    ) {
      res.statusCode = 403;
      res.end('Zakazane.');
      return;
    }

    const data = await fs.readFile(filePath);
    res.setHeader('Content-Type', types[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') {
      res.statusCode = 404;
      res.end('Nie znaleziono.');
      return;
    }
    console.error(error);
    if (!res.headersSent) res.statusCode = 500;
    res.end('Błąd serwera.');
  }
});

server.listen(port, () => {
  console.log(`Lokalnie: http://localhost:${port} (zapisy w pliku data/zapisy.json)`);
});
