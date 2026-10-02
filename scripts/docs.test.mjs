import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('documentation build renders linked static pages from Markdown without raw HTML', async () => {
  const module = await import('./docs.mjs').catch(() => ({}));
  assert.equal(typeof module.buildDocs, 'function');
  const root = await mkdtemp(join(tmpdir(), 'antwork-docs-'));
  try {
    const sourceDir = join(root, 'source'), outputDir = join(root, 'output');
    await mkdir(sourceDir);
    await writeFile(join(sourceDir, 'index.md'), '# Welcome\n\nA [guide](/docs/guide/). <script>alert(1)</script>');
    await writeFile(join(sourceDir, 'guide.md'), '# Guide\n\nStart here.');
    await module.buildDocs({ sourceDir, outputDir, pages: [
      { slug: '', title: 'Overview', file: 'index.md' },
      { slug: 'guide', title: 'Guide', file: 'guide.md' },
    ] });
    const home = await readFile(join(outputDir, 'index.html'), 'utf8');
    const guide = await readFile(join(outputDir, 'guide', 'index.html'), 'utf8');
    assert.match(home, /<h1>Welcome<\/h1>/);
    assert.match(home, /href="\/docs\/guide\/"/);
    assert.doesNotMatch(home, /<script>alert/);
    assert.match(guide, /<h1>Guide<\/h1>/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
