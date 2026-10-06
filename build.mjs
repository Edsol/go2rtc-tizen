import { build, context } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const watch = process.argv.includes('--watch');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('static', 'dist', { recursive: true });

// Tizen 3.0 (2017 TVs) runs Chromium 47: no async/await (lowered to generators), and
// let/const/class only work in strict mode, hence the banner.
const options = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  minify: !watch,
  sourcemap: watch,
  target: ['es2015'],
  format: 'iife',
  banner: { js: '"use strict";' },
  outfile: 'dist/app.js',
};

if (watch) {
  await (await context(options)).watch();
  console.log('watching…');
} else {
  await build(options);
}
