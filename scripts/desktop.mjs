import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'desktop-dist');
if (path.dirname(output) !== root) throw new Error('Desktop build output must stay inside the workspace.');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await build({ absWorkingDir: root, entryPoints: ['desktop/main.cjs', 'desktop/preload.cjs'], bundle: true, platform: 'node', format: 'cjs', target: 'node22', outdir: output, outExtension: { '.js': '.cjs' }, external: ['electron'], logLevel: 'info' });
await cp(path.join(root, 'desktop/assets/icon.ico'), path.join(output, 'icon.ico'));
const localRequire = createRequire(import.meta.url);
const squirrel = localRequire.resolve('electron-squirrel-startup/package.json');
const debug = createRequire(squirrel).resolve('debug/package.json');
const ms = createRequire(debug).resolve('ms/package.json');
await mkdir(path.join(output, 'licenses'), { recursive: true });
await cp(path.join(root, 'desktop/assets/Squirrel-COPYING.txt'), path.join(output, 'licenses/Squirrel.Windows.txt'));
for (const [name, manifest, license] of [['electron-squirrel-startup', squirrel, 'LICENSE'], ['debug', debug, 'LICENSE'], ['ms', ms, 'license.md']]) {
  await cp(path.join(path.dirname(manifest), license), path.join(output, 'licenses', `${name}.txt`));
}
if (process.platform === 'win32') {
  // npm can skip dependency install scripts; Squirrel still needs its local 7-Zip aliases.
  const installerRoot = path.dirname(localRequire.resolve('electron-winstaller/package.json'));
  execFileSync(process.execPath, [path.join(installerRoot, 'script/select-7z-arch.js')], { cwd: installerRoot, stdio: 'inherit' });
}
