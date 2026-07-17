# Constellation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma CLI Node/TS (`constellation`) que guarda o contexto de um projeto como "estrelas" markdown versionadas, entrega um índice barato + conteúdo sob demanda para agentes de IA, e oferece um grafo navegável local.

**Architecture:** Um núcleo puro (`src/core`) faz parse/serialize das estrelas e gera os artefatos (`index.md`, `constellation.json`) a partir dos `stars/*.md`. A CLI (`src/cli`) é uma casca fina sobre o núcleo. A visualização (`src/viz`) é um server HTTP local que serve um grafo Cytoscape lendo o `constellation.json`.

**Tech Stack:** Node ≥18, TypeScript (ESM), tsup (build), vitest (testes), commander (CLI), gray-matter (frontmatter), marked (render markdown na viz), cytoscape (grafo).

## Global Constraints

- **Node ≥ 18**, projeto ESM (`"type": "module"`).
- **Imports sem extensão** no source (`./types`, não `./types.js`) — build via tsup resolve; vitest também.
- **Viz self-contained:** nada de CDN externo. Bibliotecas de front (cytoscape) servidas a partir de `node_modules` pelo próprio server local.
- **Artefatos gerados** (`index.md`, `constellation.json`) nunca são editados na mão — sempre reconstruídos por `sync()` a partir de `stars/*.md`. Ambos são deterministas (ordenados por id/cluster) e commitados no git.
- **`summary` é uma linha só** (é o que aparece no índice barato).
- **Tipos de estrela:** `code-map | decision | gotcha | doc`. Mapa type→pasta: `code-map`→`code-map/`, `decision`→`decisions/`, `gotcha`→`gotchas/`, `doc`→`docs/`.

---

## File Structure

```
constellation/
  package.json
  tsconfig.json
  tsup.config.ts
  scripts/copy-assets.mjs        # copia src/viz/web → dist/web no build
  src/
    core/
      types.ts                   # Star, StarType, GraphNode/Edge, ConstellationGraph, Config
      paths.ts                   # ROOT_DIR, ALL_TYPES, TYPE_TO_DIR, *Path helpers
      star.ts                    # parseStar, serializeStar, extractWikilinks, resolvedLinks
      store.ts                   # findRoot, initStore, read/write/remove stars, readConfig
      build.ts                   # buildIndexMarkdown, buildGraph, sync
      query.ts                   # listStars, queryStars, QueryFilter
    cli/
      index.ts                   # wiring commander (bin)
      handlers.ts                # cmdInit/Save/Open/Show/Query/List/Rm/Sync
      view.ts                    # cmdView
    viz/
      server.ts                  # startServer(root, port)
      web/
        index.html
        app.js                   # cliente: cytoscape + painel
  test/
    star.test.ts
    store.test.ts
    build.test.ts
    query.test.ts
    cli.test.ts
    server.test.ts
  skill/
    SKILL.md                     # skill do Claude Code
    claude-md-snippet.md         # trecho colável em CLAUDE.md
  README.md
  .gitignore
```

---

### Task 1: Scaffold + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsup.config.ts`, `scripts/copy-assets.mjs`, `.gitignore`, `src/cli/index.ts` (stub)

**Interfaces:**
- Consumes: nada.
- Produces: `npm run build` → `dist/index.js` executável; `npm test` roda vitest; `constellation --version` imprime `0.1.0`.

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "constellation",
  "version": "0.1.0",
  "description": "Contexto de projeto para agentes de IA — estrelas versionadas, índice barato, grafo navegável",
  "type": "module",
  "bin": { "constellation": "dist/index.js" },
  "files": ["dist"],
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "tsup && node scripts/copy-assets.mjs",
    "dev": "tsx src/cli/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "gray-matter": "^4.0.3",
    "marked": "^12.0.0",
    "cytoscape": "^3.30.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsup": "^8.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "noEmit": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Criar `tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  splitting: false,
});
```

- [ ] **Step 4: Criar `scripts/copy-assets.mjs`**

```js
import { cpSync, existsSync } from 'node:fs';

if (existsSync('src/viz/web')) {
  cpSync('src/viz/web', 'dist/web', { recursive: true });
}
```

- [ ] **Step 5: Criar `.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 6: Criar stub `src/cli/index.ts`**

```ts
#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();
program
  .name('constellation')
  .description('Contexto de projeto para agentes de IA')
  .version('0.1.0');

program.parseAsync();
```

- [ ] **Step 7: Instalar e buildar**

Run: `npm install && npm run build && node dist/index.js --version`
Expected: imprime `0.1.0` (o `copy-assets` não copia nada ainda, tudo bem).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold do projeto constellation (tsup, vitest, commander)"
```

---

### Task 2: Núcleo — tipos, paths e estrela (parse/serialize/links)

**Files:**
- Create: `src/core/types.ts`, `src/core/paths.ts`, `src/core/star.ts`
- Test: `test/star.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `types.ts`: `StarType = 'code-map'|'decision'|'gotcha'|'doc'`; `interface Star { id; type; constellation; title; summary; tags: string[]; links: string[]; updated; body }`; `interface GraphNode {...}`; `interface GraphEdge { source; target }`; `interface ConstellationGraph { project; nodes: GraphNode[]; edges: GraphEdge[] }`; `interface Config { project; schema: number }`.
  - `paths.ts`: `ROOT_DIR='.constellation'`; `ALL_TYPES: StarType[]`; `TYPE_TO_DIR: Record<StarType,string>`; `starsDir(root)`; `starFilePath(root, type, id)`; `indexPath(root)`; `graphPath(root)`; `configPath(root)`.
  - `star.ts`: `extractWikilinks(body): string[]`; `resolvedLinks(star): string[]`; `parseStar(raw): Star`; `serializeStar(star): string`.

- [ ] **Step 1: Escrever teste que falha — `test/star.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { parseStar, serializeStar, extractWikilinks, resolvedLinks } from '../src/core/star';

const RAW = `---
id: backend-aportes
type: code-map
constellation: aportes
title: Backend de aportes
summary: Aportes ficam em bb-backend-python.
tags: [backend, aportes]
links: [asyncpg-id-in]
updated: 2026-07-17
---

Detalhe. Referencia [[diagrama-posicao]] e de novo [[asyncpg-id-in]].`;

describe('star', () => {
  it('faz parse do frontmatter e do corpo', () => {
    const s = parseStar(RAW);
    expect(s.id).toBe('backend-aportes');
    expect(s.type).toBe('code-map');
    expect(s.tags).toEqual(['backend', 'aportes']);
    expect(s.body).toContain('[[diagrama-posicao]]');
  });

  it('extrai wikilinks do corpo', () => {
    expect(extractWikilinks('a [[um]] b [[dois]] [[um]]')).toEqual(['um', 'dois', 'um']);
  });

  it('resolve links = frontmatter + wikilinks, deduplicado e ordenado, sem o próprio id', () => {
    const s = parseStar(RAW);
    expect(resolvedLinks(s)).toEqual(['asyncpg-id-in', 'diagrama-posicao']);
  });

  it('round-trip: parse(serialize(x)) preserva os campos', () => {
    const s = parseStar(RAW);
    const again = parseStar(serializeStar(s));
    expect(again).toEqual(s);
  });

  it('rejeita type inválido', () => {
    expect(() => parseStar('---\nid: x\ntype: banana\n---\ncorpo')).toThrow();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/star.test.ts`
Expected: FAIL (módulos não existem).

- [ ] **Step 3: Criar `src/core/types.ts`**

```ts
export type StarType = 'code-map' | 'decision' | 'gotcha' | 'doc';

export interface Star {
  id: string;
  type: StarType;
  constellation: string;
  title: string;
  summary: string;
  tags: string[];
  links: string[];
  updated: string;
  body: string;
}

export interface GraphNode {
  id: string;
  type: StarType;
  constellation: string;
  title: string;
  summary: string;
  tags: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface ConstellationGraph {
  project: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Config {
  project: string;
  schema: number;
}
```

- [ ] **Step 4: Criar `src/core/paths.ts`**

```ts
import path from 'node:path';
import type { StarType } from './types';

export const ROOT_DIR = '.constellation';

export const ALL_TYPES: StarType[] = ['code-map', 'decision', 'gotcha', 'doc'];

export const TYPE_TO_DIR: Record<StarType, string> = {
  'code-map': 'code-map',
  'decision': 'decisions',
  'gotcha': 'gotchas',
  'doc': 'docs',
};

export function starsDir(root: string): string {
  return path.join(root, 'stars');
}

export function starFilePath(root: string, type: StarType, id: string): string {
  return path.join(root, 'stars', TYPE_TO_DIR[type], `${id}.md`);
}

export function indexPath(root: string): string {
  return path.join(root, 'index.md');
}

export function graphPath(root: string): string {
  return path.join(root, 'constellation.json');
}

export function configPath(root: string): string {
  return path.join(root, 'config.json');
}
```

- [ ] **Step 5: Criar `src/core/star.ts`**

```ts
import matter from 'gray-matter';
import type { Star, StarType } from './types';
import { ALL_TYPES } from './paths';

const WIKILINK_RE = /\[\[([a-z0-9][a-z0-9-]*)\]\]/g;

export function extractWikilinks(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(WIKILINK_RE)) out.push(m[1]);
  return out;
}

export function resolvedLinks(star: Star): string[] {
  const set = new Set<string>([...star.links, ...extractWikilinks(star.body)]);
  set.delete(star.id);
  return [...set].sort();
}

export function parseStar(raw: string): Star {
  const { data, content } = matter(raw);
  const type = data.type as StarType;
  if (!ALL_TYPES.includes(type)) {
    throw new Error(`estrela inválida: type "${data.type}" não é um de ${ALL_TYPES.join(', ')}`);
  }
  if (!data.id) throw new Error('estrela inválida: falta id');
  return {
    id: String(data.id),
    type,
    constellation: String(data.constellation ?? 'geral'),
    title: String(data.title ?? data.id),
    summary: String(data.summary ?? ''),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    links: Array.isArray(data.links) ? data.links.map(String) : [],
    updated: String(data.updated ?? ''),
    body: content.trim(),
  };
}

export function serializeStar(star: Star): string {
  const fm = {
    id: star.id,
    type: star.type,
    constellation: star.constellation,
    title: star.title,
    summary: star.summary,
    tags: star.tags,
    links: star.links,
    updated: star.updated,
  };
  return matter.stringify(`${star.body}\n`, fm);
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run test/star.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(core): tipos, paths e parse/serialize de estrela"
```

---

### Task 3: Núcleo — store (I/O em disco)

**Files:**
- Create: `src/core/store.ts`
- Test: `test/store.test.ts`

**Interfaces:**
- Consumes: `paths.ts`, `star.ts`, `types.ts` (Task 2).
- Produces: `findRoot(cwd): string | null`; `initStore(cwd, project): string` (retorna o path do `.constellation`); `readConfig(root): Config`; `readAllStars(root): Star[]` (ordenado por id); `readStar(root, id): Star | null`; `writeStar(root, star): void`; `removeStar(root, id): boolean`.

- [ ] **Step 1: Escrever teste que falha — `test/store.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findRoot, initStore, readConfig, readAllStars, readStar, writeStar, removeStar } from '../src/core/store';
import type { Star } from '../src/core/types';

let tmp: string;

function star(over: Partial<Star> = {}): Star {
  return {
    id: 'estrela-a', type: 'decision', constellation: 'geral',
    title: 'A', summary: 'resumo A', tags: ['x'], links: [],
    updated: '2026-07-17', body: 'corpo A', ...over,
  };
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'const-'));
});

describe('store', () => {
  it('initStore cria a árvore e o config', () => {
    const root = initStore(tmp, 'meu-projeto');
    expect(fs.existsSync(path.join(root, 'stars', 'decisions'))).toBe(true);
    expect(readConfig(root).project).toBe('meu-projeto');
  });

  it('write/read/removeStar num round-trip', () => {
    const root = initStore(tmp, 'p');
    writeStar(root, star());
    expect(readStar(root, 'estrela-a')?.body).toBe('corpo A');
    expect(removeStar(root, 'estrela-a')).toBe(true);
    expect(readStar(root, 'estrela-a')).toBeNull();
  });

  it('readAllStars devolve ordenado por id', () => {
    const root = initStore(tmp, 'p');
    writeStar(root, star({ id: 'zebra' }));
    writeStar(root, star({ id: 'alfa' }));
    expect(readAllStars(root).map((s) => s.id)).toEqual(['alfa', 'zebra']);
  });

  it('findRoot sobe diretórios até achar .constellation', () => {
    const root = initStore(tmp, 'p');
    const sub = path.join(tmp, 'a', 'b');
    fs.mkdirSync(sub, { recursive: true });
    expect(findRoot(sub)).toBe(root);
    expect(findRoot(os.tmpdir())).not.toBe(root);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/store.test.ts`
Expected: FAIL (`store` não existe).

- [ ] **Step 3: Criar `src/core/store.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR, ALL_TYPES, TYPE_TO_DIR, starFilePath, configPath } from './paths';
import { parseStar, serializeStar } from './star';
import type { Star, Config } from './types';

export function findRoot(cwd: string): string | null {
  let dir = path.resolve(cwd);
  for (;;) {
    const candidate = path.join(dir, ROOT_DIR);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function initStore(cwd: string, project: string): string {
  const root = path.join(path.resolve(cwd), ROOT_DIR);
  for (const t of ALL_TYPES) {
    fs.mkdirSync(path.join(root, 'stars', TYPE_TO_DIR[t]), { recursive: true });
  }
  const cfg: Config = { project, schema: 1 };
  fs.writeFileSync(configPath(root), JSON.stringify(cfg, null, 2) + '\n');
  return root;
}

export function readConfig(root: string): Config {
  return JSON.parse(fs.readFileSync(configPath(root), 'utf8')) as Config;
}

export function readAllStars(root: string): Star[] {
  const stars: Star[] = [];
  for (const t of ALL_TYPES) {
    const dir = path.join(root, 'stars', TYPE_TO_DIR[t]);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      stars.push(parseStar(fs.readFileSync(path.join(dir, f), 'utf8')));
    }
  }
  stars.sort((a, b) => a.id.localeCompare(b.id));
  return stars;
}

export function readStar(root: string, id: string): Star | null {
  return readAllStars(root).find((s) => s.id === id) ?? null;
}

export function writeStar(root: string, star: Star): void {
  fs.writeFileSync(starFilePath(root, star.type, star.id), serializeStar(star));
}

export function removeStar(root: string, id: string): boolean {
  const found = readStar(root, id);
  if (!found) return false;
  fs.rmSync(starFilePath(root, found.type, found.id));
  return true;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run test/store.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): store de estrelas em disco (init, read/write/remove, findRoot)"
```

---

### Task 4: Núcleo — build do índice e do grafo (`sync`)

**Files:**
- Create: `src/core/build.ts`
- Test: `test/build.test.ts`

**Interfaces:**
- Consumes: `paths.ts`, `star.ts` (resolvedLinks), `store.ts` (readAllStars, readConfig), `types.ts`.
- Produces: `buildIndexMarkdown(project, stars): string`; `buildGraph(project, stars): ConstellationGraph`; `sync(root): void` (escreve `index.md` + `constellation.json`).

- [ ] **Step 1: Escrever teste que falha — `test/build.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildIndexMarkdown, buildGraph } from '../src/core/build';
import type { Star } from '../src/core/types';

function star(over: Partial<Star>): Star {
  return {
    id: 'x', type: 'decision', constellation: 'geral',
    title: 'X', summary: 'sX', tags: [], links: [], updated: '', body: '', ...over,
  };
}

describe('build', () => {
  it('índice agrupa por constelação e mostra 1 linha por estrela', () => {
    const md = buildIndexMarkdown('proj', [
      star({ id: 'a', constellation: 'risco', summary: 'resumo A' }),
      star({ id: 'b', constellation: 'aportes', summary: 'resumo B' }),
    ]);
    expect(md).toContain('# Constellation — proj');
    expect(md).toContain('## aportes');
    expect(md).toContain('- [b] (decision) resumo B');
    // aportes vem antes de risco (ordenado)
    expect(md.indexOf('## aportes')).toBeLessThan(md.indexOf('## risco'));
  });

  it('grafo cria arestas só para alvos existentes', () => {
    const g = buildGraph('proj', [
      star({ id: 'a', links: ['b', 'fantasma'], body: 'liga [[b]]' }),
      star({ id: 'b' }),
    ]);
    expect(g.nodes.map((n) => n.id).sort()).toEqual(['a', 'b']);
    expect(g.edges).toEqual([{ source: 'a', target: 'b' }]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/build.test.ts`
Expected: FAIL (`build` não existe).

- [ ] **Step 3: Criar `src/core/build.ts`**

```ts
import fs from 'node:fs';
import { indexPath, graphPath } from './paths';
import { resolvedLinks } from './star';
import { readAllStars, readConfig } from './store';
import type { Star, ConstellationGraph, GraphEdge } from './types';

export function buildIndexMarkdown(project: string, stars: Star[]): string {
  const byCluster = new Map<string, Star[]>();
  for (const s of stars) {
    const arr = byCluster.get(s.constellation) ?? [];
    arr.push(s);
    byCluster.set(s.constellation, arr);
  }
  const lines: string[] = [`# Constellation — ${project}`, ''];
  for (const cluster of [...byCluster.keys()].sort()) {
    lines.push(`## ${cluster}`, '');
    for (const s of byCluster.get(cluster)!) {
      lines.push(`- [${s.id}] (${s.type}) ${s.summary}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

export function buildGraph(project: string, stars: Star[]): ConstellationGraph {
  const ids = new Set(stars.map((s) => s.id));
  const edges: GraphEdge[] = [];
  for (const s of stars) {
    for (const target of resolvedLinks(s)) {
      if (ids.has(target)) edges.push({ source: s.id, target });
    }
  }
  return {
    project,
    nodes: stars.map((s) => ({
      id: s.id, type: s.type, constellation: s.constellation,
      title: s.title, summary: s.summary, tags: s.tags,
    })),
    edges,
  };
}

export function sync(root: string): void {
  const project = readConfig(root).project;
  const stars = readAllStars(root);
  fs.writeFileSync(indexPath(root), buildIndexMarkdown(project, stars));
  fs.writeFileSync(graphPath(root), JSON.stringify(buildGraph(project, stars), null, 2) + '\n');
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run test/build.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): build do index.md e constellation.json + sync"
```

---

### Task 5: Núcleo — query e list

**Files:**
- Create: `src/core/query.ts`
- Test: `test/query.test.ts`

**Interfaces:**
- Consumes: `types.ts`.
- Produces: `interface QueryFilter { type?: StarType; constellation?: string; tag?: string }`; `listStars(stars, filter?): Star[]`; `queryStars(stars, term, filter?): Star[]` (match textual em id/title/summary/body/tags).

- [ ] **Step 1: Escrever teste que falha — `test/query.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { queryStars, listStars } from '../src/core/query';
import type { Star } from '../src/core/types';

function star(over: Partial<Star>): Star {
  return {
    id: 'x', type: 'decision', constellation: 'geral',
    title: 'X', summary: '', tags: [], links: [], updated: '', body: '', ...over,
  };
}

const STARS = [
  star({ id: 'asyncpg', type: 'gotcha', constellation: 'db', body: 'estoura binds do asyncpg', tags: ['db'] }),
  star({ id: 'deploy', type: 'doc', constellation: 'ops', summary: 'como fazer deploy' }),
];

describe('query', () => {
  it('queryStars acha por texto no corpo', () => {
    expect(queryStars(STARS, 'binds').map((s) => s.id)).toEqual(['asyncpg']);
  });

  it('queryStars respeita o filtro de tipo', () => {
    expect(queryStars(STARS, 'deploy', { type: 'gotcha' })).toEqual([]);
  });

  it('listStars filtra por constelação', () => {
    expect(listStars(STARS, { constellation: 'ops' }).map((s) => s.id)).toEqual(['deploy']);
  });

  it('listStars sem filtro devolve tudo', () => {
    expect(listStars(STARS)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/query.test.ts`
Expected: FAIL (`query` não existe).

- [ ] **Step 3: Criar `src/core/query.ts`**

```ts
import type { Star, StarType } from './types';

export interface QueryFilter {
  type?: StarType;
  constellation?: string;
  tag?: string;
}

function matchesFilter(s: Star, f: QueryFilter): boolean {
  if (f.type && s.type !== f.type) return false;
  if (f.constellation && s.constellation !== f.constellation) return false;
  if (f.tag && !s.tags.includes(f.tag)) return false;
  return true;
}

export function listStars(stars: Star[], filter: QueryFilter = {}): Star[] {
  return stars.filter((s) => matchesFilter(s, filter));
}

export function queryStars(stars: Star[], term: string, filter: QueryFilter = {}): Star[] {
  const q = term.toLowerCase();
  return stars.filter((s) => {
    if (!matchesFilter(s, filter)) return false;
    const hay = [s.id, s.title, s.summary, s.body, s.tags.join(' ')].join('\n').toLowerCase();
    return hay.includes(q);
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run test/query.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): query textual e list com filtros"
```

---

### Task 6: CLI — handlers + wiring (init, save, open, sync)

**Files:**
- Create: `src/cli/handlers.ts`
- Modify: `src/cli/index.ts` (substituir o stub)
- Test: `test/cli.test.ts`

**Interfaces:**
- Consumes: todo o `core/`.
- Produces (em `handlers.ts`): `cmdInit(project): void`; `cmdSave(opts): Promise<void>` com `opts = { id; type: StarType; title; summary; constellation?; tags?; links?; updated? }` (corpo lido do **stdin**); `cmdOpen(): void`; `cmdSync(): void`. Também os handlers da Task 7 serão adicionados neste arquivo. `index.ts` registra os comandos no commander.

- [ ] **Step 1: Escrever teste que falha — `test/cli.test.ts`**

Testa a CLI *buildada* de ponta a ponta (é o contrato real). Requer `npm run build` antes.

```ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.js');
let tmp: string;

function run(args: string[], input?: string): string {
  return execFileSync('node', [CLI, ...args], { cwd: tmp, input, encoding: 'utf8' });
}

beforeAll(() => {
  execFileSync('npm', ['run', 'build'], { cwd: path.join(CLI, '..', '..'), stdio: 'ignore', shell: true });
});

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'const-cli-'));
});

describe('cli básico', () => {
  it('init cria .constellation e sync gera index', () => {
    run(['init', 'proj-teste']);
    expect(fs.existsSync(path.join(tmp, '.constellation', 'config.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, '.constellation', 'index.md'))).toBe(true);
  });

  it('save (corpo via stdin) grava a estrela e aparece no open', () => {
    run(['init', 'proj']);
    run(['save', '--id', 'a', '--type', 'gotcha', '--title', 'Gotcha A',
         '--summary', 'cuidado com X', '--constellation', 'db', '--tags', 'db,win'],
        'Corpo detalhado do gotcha.');
    const out = run(['open']);
    expect(out).toContain('## db');
    expect(out).toContain('- [a] (gotcha) cuidado com X');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/cli.test.ts`
Expected: FAIL (handlers/comandos não existem; `open`/`save` desconhecidos).

- [ ] **Step 3: Criar `src/cli/handlers.ts`**

```ts
import fs from 'node:fs';
import process from 'node:process';
import { findRoot, initStore, readAllStars, readStar, writeStar, removeStar } from '../core/store';
import { sync } from '../core/build';
import { indexPath } from '../core/paths';
import { queryStars, listStars, type QueryFilter } from '../core/query';
import { resolvedLinks } from '../core/star';
import type { Star, StarType } from '../core/types';

function requireRoot(): string {
  const root = findRoot(process.cwd());
  if (!root) {
    console.error('nenhum .constellation encontrado. rode `constellation init <projeto>` primeiro.');
    process.exit(1);
  }
  return root;
}

function splitList(v?: string): string[] {
  return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
  });
}

function printStar(s: Star): void {
  console.log(`# ${s.title}  [${s.id}]`);
  console.log(`type: ${s.type} · constellation: ${s.constellation} · tags: ${s.tags.join(', ')}`);
  console.log('');
  console.log(s.body);
}

function printSummaries(stars: Star[]): void {
  if (stars.length === 0) { console.log('(nenhuma estrela)'); return; }
  for (const s of stars) console.log(`[${s.id}] (${s.type}/${s.constellation}) ${s.summary}`);
}

export function cmdInit(project: string): void {
  if (findRoot(process.cwd())) {
    console.error('.constellation já existe aqui (ou acima). Nada a fazer.');
    process.exit(1);
  }
  const root = initStore(process.cwd(), project);
  sync(root);
  console.log(`constellation criada em ${root}`);
}

export async function cmdSave(opts: {
  id: string; type: StarType; title: string; summary: string;
  constellation?: string; tags?: string; links?: string; updated?: string;
}): Promise<void> {
  const root = requireRoot();
  const body = await readStdin();
  const star: Star = {
    id: opts.id, type: opts.type, title: opts.title, summary: opts.summary,
    constellation: opts.constellation ?? 'geral',
    tags: splitList(opts.tags), links: splitList(opts.links),
    updated: opts.updated ?? today(),
    body: body.trim(),
  };
  writeStar(root, star);
  sync(root);
  console.log(`estrela salva: ${star.id}`);
}

export function cmdOpen(): void {
  const root = requireRoot();
  process.stdout.write(fs.readFileSync(indexPath(root), 'utf8'));
}

export function cmdSync(): void {
  const root = requireRoot();
  sync(root);
  console.log('índice e grafo regenerados');
}

export function cmdShow(id: string, withLinks: boolean): void {
  const root = requireRoot();
  const star = readStar(root, id);
  if (!star) { console.error(`estrela não encontrada: ${id}`); process.exit(1); }
  printStar(star);
  if (withLinks) {
    for (const linkId of resolvedLinks(star)) {
      const n = readStar(root, linkId);
      if (n) { console.log('\n---\n'); printStar(n); }
    }
  }
}

export function cmdQuery(term: string, filter: QueryFilter): void {
  const root = requireRoot();
  printSummaries(queryStars(readAllStars(root), term, filter));
}

export function cmdList(filter: QueryFilter): void {
  const root = requireRoot();
  printSummaries(listStars(readAllStars(root), filter));
}

export function cmdRm(id: string): void {
  const root = requireRoot();
  if (!removeStar(root, id)) { console.error(`estrela não encontrada: ${id}`); process.exit(1); }
  sync(root);
  console.log(`estrela removida: ${id}`);
}
```

> Nota: `cmdShow/cmdQuery/cmdList/cmdRm` já entram aqui (usados na Task 7). O wiring deles é adicionado na Task 7; nesta task registramos só init/save/open/sync.

- [ ] **Step 4: Substituir `src/cli/index.ts`**

```ts
#!/usr/bin/env node
import { Command } from 'commander';
import { cmdInit, cmdSave, cmdOpen, cmdSync } from './handlers';

const program = new Command();
program
  .name('constellation')
  .description('Contexto de projeto para agentes de IA')
  .version('0.1.0');

program.command('init')
  .argument('<project>', 'nome do projeto')
  .action(cmdInit);

program.command('save')
  .description('cria/atualiza uma estrela (corpo markdown via stdin)')
  .requiredOption('--id <id>')
  .requiredOption('--type <type>', 'code-map | decision | gotcha | doc')
  .requiredOption('--title <title>')
  .requiredOption('--summary <summary>', 'uma linha')
  .option('--constellation <cluster>')
  .option('--tags <list>', 'separadas por vírgula')
  .option('--links <list>', 'ids separados por vírgula')
  .option('--updated <date>', 'YYYY-MM-DD')
  .action((opts) => cmdSave(opts));

program.command('open')
  .description('imprime o índice barato')
  .action(cmdOpen);

program.command('sync')
  .description('regenera index.md e constellation.json')
  .action(cmdSync);

program.parseAsync();
```

- [ ] **Step 5: Buildar e rodar o teste**

Run: `npm run build && npx vitest run test/cli.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(cli): init, save (stdin), open, sync"
```

---

### Task 7: CLI — comandos de leitura (show, query, list, rm)

**Files:**
- Modify: `src/cli/index.ts` (registrar os 4 comandos)
- Test: `test/cli.test.ts` (adicionar casos)

**Interfaces:**
- Consumes: `cmdShow/cmdQuery/cmdList/cmdRm` (já em `handlers.ts`, Task 6).
- Produces: comandos `show <id> [--links]`, `query <term> [--type --constellation --tag]`, `list [--type --constellation --tag]`, `rm <id>`.

- [ ] **Step 1: Adicionar testes que falham em `test/cli.test.ts`**

```ts
describe('cli leitura', () => {
  it('show devolve o corpo; query e list acham; rm remove', () => {
    run(['init', 'proj']);
    run(['save', '--id', 'a', '--type', 'decision', '--title', 'Dec A',
         '--summary', 'usar id_in', '--constellation', 'db', '--links', 'b'],
        'Corpo com [[b]].');
    run(['save', '--id', 'b', '--type', 'gotcha', '--title', 'Gotcha B',
         '--summary', 'cuidado', '--constellation', 'db'], 'binds do asyncpg');

    expect(run(['show', 'a'])).toContain('Corpo com [[b]].');
    expect(run(['show', 'a', '--links'])).toContain('Gotcha B');
    expect(run(['query', 'asyncpg'])).toContain('[b]');
    expect(run(['list', '--type', 'decision'])).toContain('[a]');
    expect(run(['list', '--type', 'decision'])).not.toContain('[b]');

    run(['rm', 'a']);
    expect(run(['list'])).not.toContain('[a]');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run build && npx vitest run test/cli.test.ts`
Expected: FAIL (comandos `show/query/list/rm` desconhecidos).

- [ ] **Step 3: Registrar os comandos em `src/cli/index.ts`**

Adicionar o import e os `program.command(...)` antes de `program.parseAsync();`:

```ts
import { cmdInit, cmdSave, cmdOpen, cmdSync, cmdShow, cmdQuery, cmdList, cmdRm } from './handlers';
```

```ts
program.command('show')
  .argument('<id>')
  .option('--links', 'incluir estrelas vizinhas')
  .action((id, opts) => cmdShow(id, Boolean(opts.links)));

program.command('query')
  .argument('<term>')
  .option('--type <type>')
  .option('--constellation <cluster>')
  .option('--tag <tag>')
  .action((term, opts) => cmdQuery(term, opts));

program.command('list')
  .option('--type <type>')
  .option('--constellation <cluster>')
  .option('--tag <tag>')
  .action((opts) => cmdList(opts));

program.command('rm')
  .argument('<id>')
  .action(cmdRm);
```

- [ ] **Step 4: Buildar e rodar**

Run: `npm run build && npx vitest run test/cli.test.ts`
Expected: PASS (todos os casos, incluindo os novos).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(cli): show, query, list, rm"
```

---

### Task 8: Visualização — server + grafo Cytoscape

**Files:**
- Create: `src/viz/server.ts`, `src/viz/web/index.html`, `src/viz/web/app.js`, `src/cli/view.ts`
- Modify: `src/cli/index.ts` (registrar `view`)
- Test: `test/server.test.ts`

**Interfaces:**
- Consumes: `graphPath` (paths), `readStar` (store), `marked`.
- Produces: `startServer(root, port): Promise<{ url: string; close: () => void }>`; `cmdView(port): Promise<void>`. Rotas do server: `GET /` (html), `GET /app.js`, `GET /cytoscape.js` (de node_modules), `GET /data` (o constellation.json), `GET /star/:id` (markdown do corpo renderizado em HTML).

- [ ] **Step 1: Escrever teste que falha — `test/server.test.ts`**

```ts
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
});
```

> Nota: `startServer(root, 0)` deve usar a porta efetiva atribuída pelo SO na `url`. Implemente lendo `server.address().port` após `listen`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run test/server.test.ts`
Expected: FAIL (`server` não existe).

- [ ] **Step 3: Criar `src/viz/server.ts`**

```ts
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { graphPath } from '../core/paths';
import { readStar } from '../core/store';

const require = createRequire(import.meta.url);
const dirname = path.dirname(fileURLToPath(import.meta.url));

function cytoscapePath(): string {
  const pkg = require.resolve('cytoscape/package.json');
  return path.join(path.dirname(pkg), 'dist', 'cytoscape.umd.js');
}

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
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/') return sendFile(res, path.join(webDir, 'index.html'), 'text/html; charset=utf-8');
    if (url.pathname === '/app.js') return sendFile(res, path.join(webDir, 'app.js'), 'text/javascript');
    if (url.pathname === '/cytoscape.js') return sendFile(res, cytoscapePath(), 'text/javascript');
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
  });
  return new Promise((resolve) => {
    server.listen(port, () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      resolve({ url: `http://localhost:${actualPort}`, close: () => server.close() });
    });
  });
}
```

- [ ] **Step 4: Criar `src/viz/web/index.html`**

```html
<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8" />
  <title>Constellation</title>
  <style>
    html, body { margin: 0; height: 100%; font-family: system-ui, sans-serif; background: #0b0f1a; color: #e8ecf5; }
    #cy { position: absolute; inset: 0 360px 0 0; }
    #panel { position: absolute; top: 0; right: 0; bottom: 0; width: 360px; overflow: auto;
             padding: 16px 20px; box-sizing: border-box; background: #121a2b; border-left: 1px solid #223; }
    #panel h1, #panel h2, #panel h3 { color: #fff; }
    #panel code { background: #0b0f1a; padding: 1px 4px; border-radius: 4px; }
    .hint { color: #8b96ad; }
  </style>
</head>
<body>
  <div id="cy"></div>
  <div id="panel"><p class="hint">Clique numa estrela para ler.</p></div>
  <script src="/cytoscape.js"></script>
  <script src="/app.js"></script>
</body>
</html>
```

- [ ] **Step 5: Criar `src/viz/web/app.js`**

```js
const TYPE_COLOR = {
  'code-map': '#4fa3ff',
  'decision': '#ffb454',
  'gotcha':   '#ff5c7a',
  'doc':      '#5cd6a8',
};

async function main() {
  const graph = await (await fetch('/data')).json();
  document.title = `Constellation — ${graph.project}`;

  const elements = [
    ...graph.nodes.map((n) => ({
      data: { id: n.id, label: n.title, type: n.type, constellation: n.constellation },
    })),
    ...graph.edges.map((e) => ({ data: { source: e.source, target: e.target } })),
  ];

  const cy = cytoscape({
    container: document.getElementById('cy'),
    elements,
    style: [
      { selector: 'node', style: {
        'background-color': (el) => TYPE_COLOR[el.data('type')] || '#889',
        'label': 'data(label)', 'color': '#e8ecf5', 'font-size': 10,
        'text-valign': 'bottom', 'text-margin-y': 4,
      } },
      { selector: 'edge', style: {
        'width': 1, 'line-color': '#33415c', 'curve-style': 'bezier',
        'target-arrow-color': '#33415c', 'target-arrow-shape': 'triangle', 'arrow-scale': 0.7,
      } },
    ],
    layout: { name: 'cose', animate: false, padding: 40 },
  });

  const panel = document.getElementById('panel');
  cy.on('tap', 'node', async (evt) => {
    const id = evt.target.id();
    panel.innerHTML = `<p class="hint">${id}</p>` + await (await fetch(`/star/${encodeURIComponent(id)}`)).text();
  });
}

main();
```

- [ ] **Step 6: Criar `src/cli/view.ts`**

```ts
import process from 'node:process';
import { findRoot } from '../core/store';
import { startServer } from '../viz/server';

export async function cmdView(port: number): Promise<void> {
  const root = findRoot(process.cwd());
  if (!root) {
    console.error('nenhum .constellation encontrado. rode `constellation init <projeto>`.');
    process.exit(1);
  }
  const { url } = await startServer(root, port);
  console.log(`Constellation aberta em ${url} (Ctrl+C pra sair)`);
}
```

- [ ] **Step 7: Registrar `view` em `src/cli/index.ts`**

Adicionar o import e o comando:

```ts
import { cmdView } from './view';
```

```ts
program.command('view')
  .description('abre o grafo no browser')
  .option('--port <port>', 'porta', '4747')
  .action((opts) => cmdView(Number(opts.port)));
```

- [ ] **Step 8: Rodar teste do server e build**

Run: `npx vitest run test/server.test.ts && npm run build`
Expected: server PASS (2 testes); build gera `dist/index.js` e `dist/web/`.

- [ ] **Step 9: Smoke manual (opcional, recomendado)**

Run: num projeto de teste com estrelas, `node <repo>/dist/index.js view` e abrir a URL no browser; confirmar nós coloridos por tipo e painel ao clicar.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(viz): server local + grafo cytoscape read-only (view)"
```

---

### Task 9: A skill (adoção pelo agente)

**Files:**
- Create: `skill/SKILL.md`, `skill/claude-md-snippet.md`

**Interfaces:**
- Consumes: a CLI completa (Tasks 6–8).
- Produces: documentação de uso para agentes. Sem código; deliverable é textual.

- [ ] **Step 1: Criar `skill/SKILL.md`**

````markdown
---
name: constellation
description: Use no início de cada sessão para carregar o contexto do projeto de forma barata, e sempre que aprender algo durável (decisão, gotcha, mapa de código, how-to) para salvá-lo. Requer a CLI `constellation` instalada e uma pasta `.constellation/` no projeto.
---

# Constellation

Memória de projeto versionada para agentes. Em vez de reexplorar o repo,
consulte a constelação; ao aprender algo durável, salve.

## No início da sessão

1. Rode `constellation open` e leia o índice (1 linha por estrela).
2. Só puxe o conteúdo completo do que for relevante:
   - `constellation show <id>` (use `--links` para trazer as estrelas vizinhas)
   - `constellation query <termo> [--type --constellation --tag]`
3. **Prefira isso a explorar o repo.** É o que economiza token.

## Ao aprender algo durável — salve

Uma estrela = um fato. Salve com o corpo markdown via stdin:

```bash
printf '%s' "Corpo em markdown, pode citar outras estrelas com [[outro-id]]." \
  | constellation save --id asyncpg-in-limit --type gotcha \
      --title "IN grande estoura binds do asyncpg" \
      --summary "WHERE col IN (lista grande) passa de 32767 binds; use id_in() (= ANY array)." \
      --constellation db --tags "db,asyncpg" --links "dashboard-risco"
```

Tipos: `code-map` (onde as coisas moram), `decision` (o porquê),
`gotcha` (armadilha/workaround), `doc` (como rodar/deploy, links).

## O que salvar

- Mapa do código, decisões e seus porquês, gotchas, how-tos e referências.

## O que NÃO salvar

- O que o código/git já conta (estrutura óbvia, histórico de commits).
- O que só importa nesta conversa.
- Segredos/credenciais.

## Regras

- `summary` é uma linha (é o que aparece no índice).
- Conecte estrelas relacionadas com `[[id]]` no corpo ou `--links`.
- Ao terminar algo, atualize a estrela relevante (`save` com o mesmo `--id`).
- `constellation view` abre o grafo no browser quando o humano quiser ver.
````

- [ ] **Step 2: Criar `skill/claude-md-snippet.md`**

```markdown
## Constellation (memória de projeto)

Este projeto usa Constellation. **No início:** rode `constellation open` e leia o
índice; puxe detalhes com `constellation show <id>` / `constellation query <termo>`
em vez de explorar o repo. **Ao aprender algo durável** (decisão, gotcha, mapa de
código, how-to): salve com `constellation save --id <id> --type <code-map|decision|gotcha|doc>
--title <t> --summary <uma-linha> [--constellation <cluster>] [--tags a,b] [--links x,y]`
(o corpo markdown vem via stdin). Uma estrela = um fato; conecte com `[[id]]`.
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs(skill): skill do Claude Code + snippet de CLAUDE.md"
```

---

### Task 10: README + empacotamento npm

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: tudo.
- Produces: `npm pack` inclui só `dist/` + README/package.json; README documenta instalação e comandos.

- [ ] **Step 1: Criar `README.md`**

```markdown
# Constellation

Contexto de projeto para agentes de IA. Guarda "estrelas" (unidades de
conhecimento) versionadas em `.constellation/`, entrega um índice barato +
conteúdo sob demanda (economia de token) e visualiza tudo como um grafo.

## Instalação

```bash
npm install -g constellation
# ou, sem instalar:
npx constellation <comando>
```

## Uso

```bash
constellation init "meu-projeto"     # cria .constellation/
constellation open                   # índice barato (início de sessão)
constellation show <id> [--links]    # conteúdo completo de uma estrela
constellation query <termo>          # busca (--type/--constellation/--tag)
constellation list                   # lista estrelas
echo "corpo md" | constellation save --id x --type gotcha --title "T" --summary "uma linha"
constellation rm <id>
constellation sync                   # regenera index.md + constellation.json
constellation view                   # abre o grafo no browser
```

## Integração com agentes

Copie `skill/claude-md-snippet.md` para o `CLAUDE.md` do projeto, ou instale a
skill em `skill/SKILL.md`. Ela ensina o agente a abrir o contexto no início e a
salvar o que aprende.

## Modelo de dados

Cada estrela é um markdown em `.constellation/stars/<tipo>/<id>.md` com
frontmatter (`id`, `type`, `constellation`, `title`, `summary`, `tags`, `links`,
`updated`). `index.md` e `constellation.json` são gerados por `sync` — não edite
na mão.
```

- [ ] **Step 2: Verificar o conteúdo do pacote**

Run: `npm run build && npm pack --dry-run`
Expected: lista inclui `dist/index.js`, `dist/web/index.html`, `dist/web/app.js`, `package.json`, `README.md` — e NÃO inclui `src/` nem `test/`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: README + empacotamento"
```

---

## Self-Review (feito na escrita do plano)

- **Cobertura do spec:** modelo de dados/pastas (T2–T3), índice barato + sob demanda (T4/T6/T7), captura pela IA via skill (T9), grafo read-only agrupado por constelação e colorido por tipo (T8), stack Node/TS+npm (T1/T10), formato 1-md-por-estrela + gerados (T2–T4), wikilinks + cluster (T2/T4/T8). ✔
- **Fora de escopo (YAGNI) respeitado:** sem edição na UI, sem arestas tipadas, sem hooks, sem embeddings, sem multi-projeto global, sem detecção de obsolescência. ✔
- **Consistência de tipos:** `Star`, `QueryFilter`, `startServer` e os `cmd*` têm as mesmas assinaturas onde são consumidos. ✔
- **Sem placeholders:** todo passo tem código/comando concreto. ✔
```
