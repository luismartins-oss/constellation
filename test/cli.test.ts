import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.js');
let tmp: string;

function run(args: string[], input?: string): string {
  return execFileSync('node', [CLI, ...args], { cwd: tmp, input, encoding: 'utf8' });
}

beforeAll(() => {
  execFileSync('npm', ['run', 'build'], { cwd: path.join(CLI, '..', '..'), stdio: 'ignore', shell: true });
});

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'const-cli-'));
});

describe('cli básico', () => {
  it('init cria .constellation e sync gera index', () => {
    run(['init', 'proj-teste']);
    expect(fs.existsSync(path.join(tmp, '.constellation', 'config.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, '.constellation', 'index.md'))).toBe(true);
  });

  it('save (corpo via stdin) grava a estrela e aparece no open', () => {
    run(['init', 'proj']);
    run(['save', '--id', 'a', '--type', 'gotcha', '--title', 'Gotcha A',
         '--summary', 'cuidado com X', '--constellation', 'db', '--tags', 'db,win'],
        'Corpo detalhado do gotcha.');
    const out = run(['open']);
    expect(out).toContain('## db');
    expect(out).toContain('- [a] (gotcha) cuidado com X');
  });
});

describe('cli leitura', () => {
  it('show devolve o corpo; query e list acham; rm remove', () => {
    run(['init', 'proj']);
    run(['save', '--id', 'a', '--type', 'decision', '--title', 'Dec A',
         '--summary', 'usar id_in', '--constellation', 'db', '--links', 'b'],
        'Corpo com [[b]].');
    run(['save', '--id', 'b', '--type', 'gotcha', '--title', 'Gotcha B',
         '--summary', 'cuidado', '--constellation', 'db'], 'binds do asyncpg');

    expect(run(['show', 'a'])).toContain('Corpo com [[b]].');
    expect(run(['show', 'a', '--links'])).toContain('Gotcha B');
    expect(run(['query', 'asyncpg'])).toContain('[b]');
    expect(run(['list', '--type', 'decision'])).toContain('[a]');
    expect(run(['list', '--type', 'decision'])).not.toContain('[b]');

    run(['rm', 'a']);
    expect(run(['list'])).not.toContain('[a]');
  });
});
