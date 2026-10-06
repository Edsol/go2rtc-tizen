import { build, context } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const watch = process.argv.includes('--watch');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('static', 'dist', { recursive: true });

// es2017 keeps the bundle runnable on the Chromium shipped with 2018-2019 TVs
const options = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  minify: !watch,
  sourcemap: watch,
  target: ['es2017', 'chrome56'],
  outfile: 'dist/app.js',
};

if (watch) {
  await (await context(options)).watch();
  console.log('watching…');
} else {
  await build(options);
}
