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
