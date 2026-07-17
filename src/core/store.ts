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
      const file = path.join(dir, f);
      try {
        stars.push(parseStar(fs.readFileSync(file, 'utf8')));
      } catch (err) {
        // um .md malformado (ex: hand-edit) não deve quebrar a leitura dos válidos
        console.warn(`constellation: ignorando estrela inválida ${file}: ${(err as Error).message}`);
      }
    }
  }
  stars.sort((a, b) => a.id.localeCompare(b.id));
  return stars;
}

export function readStar(root: string, id: string): Star | null {
  return readAllStars(root).find((s) => s.id === id) ?? null;
}

export function writeStar(root: string, star: Star): void {
  // garante 1 arquivo por id: remove versão anterior noutro tipo, se houver
  for (const t of ALL_TYPES) {
    const p = starFilePath(root, t, star.id);
    if (t !== star.type && fs.existsSync(p)) fs.rmSync(p);
  }
  fs.writeFileSync(starFilePath(root, star.type, star.id), serializeStar(star));
}

export function removeStar(root: string, id: string): boolean {
  const found = readStar(root, id);
  if (!found) return false;
  fs.rmSync(starFilePath(root, found.type, found.id));
  return true;
}
