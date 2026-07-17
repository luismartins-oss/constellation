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
