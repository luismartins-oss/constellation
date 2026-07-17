import matter from 'gray-matter';
import type { Star, StarType } from './types';
import { ALL_TYPES } from './paths';

const WIKILINK_RE = /\[\[([a-z0-9][a-z0-9-]*)\]\]/g;

// id = mesma gramática do wikilink; usado como nome de arquivo, chave de grafo e token no índice
export const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

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
  const id = String(data.id);
  if (!ID_RE.test(id)) {
    throw new Error(`estrela inválida: id "${id}" deve casar ${String(ID_RE)} (minúsculas, números e hífens)`);
  }
  return {
    id,
    type,
    constellation: String(data.constellation ?? 'geral'),
    title: String(data.title ?? data.id),
    summary: String(data.summary ?? ''),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    links: Array.isArray(data.links) ? data.links.map(String) : [],
    // js-yaml parseia `updated: 2026-07-17` (sem aspas) como Date; normalizar p/ ISO YYYY-MM-DD.
    updated: data.updated instanceof Date ? data.updated.toISOString().slice(0, 10) : String(data.updated ?? ''),
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
