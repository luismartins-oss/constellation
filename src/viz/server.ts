import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { graphPath } from '../core/paths';
import { readStar } from '../core/store';

const dirname = path.dirname(fileURLToPath(import.meta.url));

function sendFile(res: http.ServerResponse, file: string, type: string): void {
  fs.readFile(file, (err, buf) => {
    if (err) { res.statusCode = 404; res.end('não encontrado'); return; }
    res.setHeader('Content-Type', type);
    res.end(buf);
  });
}

export function startServer(root: string, port: number): Promise<{ url: string; close: () => void }> {
  const webDir = path.join(dirname, 'web');
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname === '/') return sendFile(res, path.join(webDir, 'index.html'), 'text/html; charset=utf-8');
      if (url.pathname === '/app.js') return sendFile(res, path.join(webDir, 'app.js'), 'text/javascript');
      if (url.pathname === '/cytoscape.js') return sendFile(res, path.join(webDir, 'cytoscape.umd.js'), 'text/javascript');
      if (url.pathname === '/data') return sendFile(res, graphPath(root), 'application/json');
      if (url.pathname.startsWith('/star/')) {
        const id = decodeURIComponent(url.pathname.slice('/star/'.length));
        const star = readStar(root, id);
        if (!star) { res.statusCode = 404; res.end('não encontrada'); return; }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(await marked.parse(star.body));
        return;
      }
      res.statusCode = 404;
      res.end('não encontrado');
    } catch (err) {
      // um erro num handler não deve derrubar o processo do server
      res.statusCode = 500;
      res.end(`erro interno: ${(err as Error).message}`);
    }
  });
  return new Promise((resolve) => {
    server.listen(port, () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      resolve({ url: `http://localhost:${actualPort}`, close: () => server.close() });
    });
  });
}
