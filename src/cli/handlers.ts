import fs from 'node:fs';
import process from 'node:process';
import { findRoot, initStore, writeStar } from '../core/store';
import { sync } from '../core/build';
import { indexPath } from '../core/paths';
import type { Star, StarType } from '../core/types';

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
