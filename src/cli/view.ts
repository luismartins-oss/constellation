import process from 'node:process';
import { findRoot } from '../core/store';
import { startServer } from '../viz/server';

export async function cmdView(port: number): Promise<void> {
  const root = findRoot(process.cwd());
  if (!root) {
    console.error('nenhum .constellation encontrado. rode `constellation init <projeto>`.');
    process.exit(1);
  }
  const { url } = await startServer(root, port);
  console.log(`Constellation aberta em ${url} (Ctrl+C pra sair)`);
}
