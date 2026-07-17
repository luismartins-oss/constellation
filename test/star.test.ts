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
    expect(s.updated).toBe('2026-07-17'); // Date do YAML normalizado p/ ISO
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

  it('rejeita id com caracteres inválidos (barra/traversal/maiúscula)', () => {
    expect(() => parseStar('---\nid: ../evil\ntype: doc\n---\ncorpo')).toThrow();
    expect(() => parseStar('---\nid: NaoPode\ntype: doc\n---\ncorpo')).toThrow();
  });
});
