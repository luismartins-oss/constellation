import { describe, it, expect } from 'vitest';
import { buildIndexMarkdown, buildGraph } from '../src/core/build';
import type { Star } from '../src/core/types';

function star(over: Partial<Star>): Star {
  return {
    id: 'x', type: 'decision', constellation: 'geral',
    title: 'X', summary: 'sX', tags: [], links: [], files: [], refs: [], updated: '', body: '', ...over,
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
