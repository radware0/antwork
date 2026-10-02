import { build, context } from 'esbuild';
import { watch } from 'node:fs';
import { mkdir, cp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import { buildDocs } from './docs.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const production = process.argv.includes('--build');
const outputDir = fileURLToPath(new URL('../dist/', import.meta.url));
if (production) {
  if (resolve(outputDir, '..') !== resolve(root)) throw new Error('Refusing to clear output outside the project root');
  await rm(outputDir, { recursive: true, force: true });
}
await mkdir(root + 'dist', { recursive: true });
await cp(root + 'public', root + 'dist', { recursive: true });
const html = (await readFile(root + 'index.html', 'utf8')).replace(/<script type="module"[^>]*><\/script>/, '<link rel="stylesheet" href="/assets/main.css"><script type="module" src="/assets/main.js"></script>');
await writeFile(root + 'dist/index.html', html);
await buildDocs();
const tailwindPlugin = {
  name: 'antwork-tailwind',
  setup(build) {
    build.onLoad({ filter: /[\\/]tailwind\.css$/ }, async args => {
      const source = await readFile(args.path, 'utf8');
      // Inline the package theme: Tailwind's import resolver misreads the # in this workspace path.
      const theme = await readFile(root + 'node_modules/tailwindcss/theme.css', 'utf8');
      const result = await postcss([tailwindcss({ base: root, optimize: production })]).process(theme + '\n' + source, { from: args.path });
      const files = await readdir(root + 'src', { recursive: true });
      return { contents: result.css, loader: 'css', watchFiles: [args.path, ...files.filter(file => /\.(tsx?|css)$/.test(file)).map(file => root + 'src/' + file.replaceAll('\\', '/'))] };
    });
  },
};
const options = { absWorkingDir: root, entryPoints: ['src/main.tsx'], bundle: true, splitting: true, outdir: 'dist/assets', format: 'esm', jsx: 'automatic', target: 'es2022', minify: production, sourcemap: !production, external: ['/fonts/*'], loader: { '.woff': 'file', '.woff2': 'file' }, alias: { '@': root + 'src' }, plugins: [tailwindPlugin], define: { 'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development') }, logLevel: 'info' };
if (production) await build(options);
else {
 const ctx = await context(options);
 await ctx.watch();
 const docsWatcher = watch(root + 'docs', { recursive: true }, () => {
   void buildDocs().catch(error => console.error('Could not rebuild docs:', error));
 });
 const { port } = await ctx.serve({ servedir: root + 'dist', host: '127.0.0.1', port: 5173 });
 console.log('antwork: http://localhost:' + port);
 process.on('SIGINT', async () => { docsWatcher.close(); await ctx.dispose(); process.exit(0); });
}
