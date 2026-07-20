#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { cmdInit, cmdSave, cmdOpen, cmdSync, cmdShow, cmdQuery, cmdList, cmdRm } from './handlers';
import { cmdView } from './view';

// versão lida do package.json (evita drift entre CLI e o pacote)
const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
const version = (JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string }).version;

const program = new Command();
program
  .name('constellation')
  .description('Contexto de projeto para agentes de IA')
  .version(version);

program.command('init')
  .argument('<project>', 'nome do projeto')
  .action(cmdInit);

program.command('save')
  .description('cria/atualiza uma estrela (corpo markdown via stdin)')
  .requiredOption('--id <id>')
  .requiredOption('--type <type>', 'code-map | decision | gotcha | doc')
  .requiredOption('--title <title>')
  .requiredOption('--summary <summary>', 'uma linha')
  .option('--constellation <cluster>')
  .option('--tags <list>', 'separadas por vírgula')
  .option('--links <list>', 'ids separados por vírgula')
  .option('--files <list>', 'arquivos/caminhos relevantes, separados por vírgula')
  .option('--refs <list>', 'referências (links/tickets), separadas por vírgula')
  .option('--updated <date>', 'YYYY-MM-DD')
  .action((opts) => cmdSave(opts));

program.command('open')
  .description('imprime o índice barato')
  .action(cmdOpen);

program.command('sync')
  .description('regenera index.md e constellation.json')
  .action(cmdSync);

program.command('show')
  .argument('<id>')
  .option('--links', 'incluir estrelas vizinhas')
  .action((id, opts) => cmdShow(id, Boolean(opts.links)));

program.command('query')
  .argument('<term>')
  .option('--type <type>')
  .option('--constellation <cluster>')
  .option('--tag <tag>')
  .action((term, opts) => cmdQuery(term, opts));

program.command('list')
  .option('--type <type>')
  .option('--constellation <cluster>')
  .option('--tag <tag>')
  .action((opts) => cmdList(opts));

program.command('rm')
  .argument('<id>')
  .action(cmdRm);

program.command('view')
  .description('abre o grafo no browser')
  .option('--port <port>', 'porta', '4747')
  .action((opts) => cmdView(Number(opts.port)));

program.parseAsync().catch((err) => {
  console.error(`erro: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
