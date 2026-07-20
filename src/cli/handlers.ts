import fs from 'node:fs';
import process from 'node:process';
import { findRoot, initStore, writeStar } from '../core/store';
import { sync } from '../core/build';
import { indexPath, ALL_TYPES } from '../core/paths';
import type { Star, StarType } from '../core/types';
import { readAllStars, readStar, removeStar } from '../core/store';
import { queryStars, listStars, type QueryFilter } from '../core/query';
import { resolvedLinks, ID_RE } from '../core/star';

export function requireRoot(): string {
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
  constellation?: string; tags?: string; links?: string; files?: string; refs?: string; updated?: string;
}): Promise<void> {
  if (!ID_RE.test(opts.id)) {
    console.error(`id inválido: "${opts.id}" — use apenas minúsculas, números e hífens (ex: backend-aportes).`);
    process.exit(1);
  }
  if (!ALL_TYPES.includes(opts.type)) {
    console.error(`type inválido: "${opts.type}" — use um de: ${ALL_TYPES.join(', ')}.`);
    process.exit(1);
  }
  const root = requireRoot();
  const body = await readStdin();
  const star: Star = {
    id: opts.id, type: opts.type, title: opts.title, summary: opts.summary,
    constellation: opts.constellation ?? 'geral',
    tags: splitList(opts.tags), links: splitList(opts.links),
    files: splitList(opts.files), refs: splitList(opts.refs),
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

function printStar(s: Star): void {
  console.log(`# ${s.title}  [${s.id}]`);
  console.log(`type: ${s.type} · constellation: ${s.constellation} · tags: ${s.tags.join(', ')}`);
  if (s.files.length) console.log(`arquivos: ${s.files.join(', ')}`);
  if (s.refs.length) console.log(`refs: ${s.refs.join(', ')}`);
  console.log('');
  console.log(s.body);
}

function printSummaries(stars: Star[]): void {
  if (stars.length === 0) { console.log('(nenhuma estrela)'); return; }
  for (const s of stars) console.log(`[${s.id}] (${s.type}/${s.constellation}) ${s.summary}`);
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
