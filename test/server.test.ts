import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initStore, writeStar } from '../src/core/store';
import { sync } from '../src/core/build';
import { startServer } from '../src/viz/server';
import type { Star } from '../src/core/types';

let tmp: string, root: string, server: { url: string; close: () => void };

beforeEach(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'const-viz-'));
  root = initStore(tmp, 'proj');
  const s: Star = {
    id: 'a', type: 'decision', constellation: 'db', title: 'Dec A',
    summary: 's', tags: [], links: [], updated: '2026-07-17', body: '## Detalhe\ntexto',
  };
  writeStar(root, s);
  sync(root);
  server = await startServer(root, 0); // porta 0 = efêmera
});

afterEach(() => server.close());

describe('viz server', () => {
  it('/data devolve o grafo', async () => {
    const g = await (await fetch(`${server.url}/data`)).json();
    expect(g.nodes.map((n: any) => n.id)).toEqual(['a']);
  });

  it('/star/a devolve o corpo renderizado em html', async () => {
    const html = await (await fetch(`${server.url}/star/a`)).text();
    expect(html).toContain('<h2');
    expect(html).toContain('texto');
  });

  it('/ e /app.js servem os assets estáticos', async () => {
    expect((await fetch(`${server.url}/`)).status).toBe(200);
    expect((await fetch(`${server.url}/app.js`)).status).toBe(200);
  });
});
