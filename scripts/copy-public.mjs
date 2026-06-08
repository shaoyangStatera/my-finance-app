import { cpSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const publicDir = resolve('public');
const distDir = resolve('dist');

if (!existsSync(distDir)) {
  console.error('dist/ not found — run expo export first');
  process.exit(1);
}

if (existsSync(publicDir)) {
  cpSync(publicDir, distDir, { recursive: true });
  console.log('Copied public/ → dist/');
}
