import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findRoot, initStore, readConfig, readAllStars, readStar, writeStar, removeStar } from '../src/core/store';
import type { Star } from '../src/core/types';

let tmp: string;

function star(over: Partial<Star> = {}): Star {
  return {
    id: 'estrela-a', type: 'decision', constellation: 'geral',
    title: 'A', summary: 'resumo A', tags: ['x'], links: [], files: [], refs: [],
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

  it('writeStar re-tipando um id não deixa duplicata', () => {
    const root = initStore(tmp, 'p');
    writeStar(root, star({ id: 'x', type: 'decision' }));
    writeStar(root, star({ id: 'x', type: 'gotcha' }));
    expect(readAllStars(root).filter((s) => s.id === 'x')).toHaveLength(1);
    expect(readStar(root, 'x')?.type).toBe('gotcha');
    expect(removeStar(root, 'x')).toBe(true);
    expect(readStar(root, 'x')).toBeNull();
  });

  it('readAllStars ignora arquivo malformado e ainda lê os válidos', () => {
    const root = initStore(tmp, 'p');
    writeStar(root, star({ id: 'ok' }));
    fs.writeFileSync(path.join(root, 'stars', 'decisions', 'ruim.md'), '---\nsem_id: true\n---\ncorpo');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => readStar(root, 'ok')).not.toThrow();
    expect(readStar(root, 'ok')?.id).toBe('ok');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
