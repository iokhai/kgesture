import { build, context } from 'esbuild';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { writeIcons } from './icons.mjs';
import { checkLocales } from './check-locales.mjs';

await checkLocales();
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await cp('LICENSE', 'dist/LICENSE');
await writeIcons('dist/icons');
const watch = process.argv.includes('--watch');
const common = { bundle: true, minify: !watch, sourcemap: watch, target: 'chrome120', legalComments: 'none', logLevel: 'info' };
const configs = [
  { ...common, entryPoints: ['src/content/index.ts'], outfile: 'dist/content.js', format: 'iife' },
  { ...common, entryPoints: { background: 'src/background/index.ts', options: 'src/options/index.ts' }, outdir: 'dist', format: 'esm' },
];
if (watch) {
  const contexts = await Promise.all(configs.map(config => context(config)));
  await Promise.all(contexts.map(ctx => ctx.watch()));
  console.log('Watching TypeScript. Reload the extension and web page after changes. Public files require pnpm build.');
} else {
  await Promise.all(configs.map(config => build(config)));
  const files = {};
  for (const name of await readdir('dist')) {
    if (name.endsWith('.js')) {
      const data = await readFile(`dist/${name}`);
      files[name] = { bytes: (await stat(`dist/${name}`)).size, gzipBytes: gzipSync(data).length };
    }
  }
  await writeFile('dist/build-metrics.json', JSON.stringify(files, null, 2));
  if (files['content.js'].bytes > 24 * 1024) throw new Error('Content script exceeds the 24 KiB budget');
  console.table(files);
}
