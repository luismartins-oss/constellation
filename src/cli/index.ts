#!/usr/bin/env node
import { Command } from 'commander';
import { cmdInit, cmdSave, cmdOpen, cmdSync } from './handlers';

const program = new Command();
program
  .name('constellation')
  .description('Contexto de projeto para agentes de IA')
  .version('0.1.0');

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
  .option('--updated <date>', 'YYYY-MM-DD')
  .action((opts) => cmdSave(opts));

program.command('open')
  .description('imprime o índice barato')
  .action(cmdOpen);

program.command('sync')
  .description('regenera index.md e constellation.json')
  .action(cmdSync);

program.parseAsync();
