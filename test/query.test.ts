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
