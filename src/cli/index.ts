#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();
program
  .name('constellation')
  .description('Contexto de projeto para agentes de IA')
  .version('0.1.0');

program.parseAsync();
