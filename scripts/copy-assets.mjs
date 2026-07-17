import { cpSync, existsSync } from 'node:fs';

if (existsSync('src/viz/web')) {
  cpSync('src/viz/web', 'dist/web', { recursive: true });
}
