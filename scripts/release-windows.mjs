import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseRoot = path.join(root, 'release', 'windows');
const appRoot = path.join(releaseRoot, 'app');
if (path.dirname(appRoot) !== releaseRoot) throw new Error('Release staging must stay inside the Windows release folder.');
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
await rm(appRoot, { recursive: true, force: true });
await mkdir(appRoot, { recursive: true });
for (const name of ['dist', 'desktop-dist']) await cp(path.join(root, name), path.join(appRoot, name), { recursive: true });
await cp(path.join(root, 'THIRD_PARTY_NOTICES.md'), path.join(appRoot, 'THIRD_PARTY_NOTICES.md'));
await writeFile(path.join(appRoot, 'package.json'), `${JSON.stringify({
  name: manifest.name,
  version: manifest.version,
  productName: manifest.productName,
  description: manifest.description,
  main: manifest.main,
}, null, 2)}\n`);
