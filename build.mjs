import { build, context, transform } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

const watch = process.argv.includes('--watch');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('static', 'dist', { recursive: true });

const options = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'iife',
  target: ['es2017'],
  outfile: 'dist/app.js',
};

// Tizen 3.0 (2017 TVs) runs Chromium 47, which lacks destructuring, default parameters
// and async/await, and esbuild cannot lower to ES5 — so the bundle goes through tsc.
async function toEs5() {
  const src = readFileSync('dist/app.js', 'utf8');
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES5, downlevelIteration: true, allowJs: true },
  });
  const { code } = await transform(outputText, { minify: !watch, target: 'es5' });
  writeFileSync('dist/app.js', code);
}

if (watch) {
  const ctx = await context({ ...options, plugins: [{ name: 'es5', setup: (b) => b.onEnd(toEs5) }] });
  await ctx.watch();
  console.log('watching…');
} else {
  await build(options);
  await toEs5();
}
