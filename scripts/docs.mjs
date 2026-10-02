import MarkdownIt from 'markdown-it';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const docsPages = [
  { slug: '', title: 'Overview', file: 'index.md' },
  { slug: 'daily-loop', title: 'Daily loop', file: 'daily-loop.md' },
  { slug: 'features', title: 'Features and rules', file: 'features.md' },
  { slug: 'decisions', title: 'Decision history', file: 'decisions.md' },
  { slug: 'architecture', title: 'Architecture', file: 'architecture.md' },
  { slug: 'privacy', title: 'Data and privacy', file: 'privacy.md' },
  { slug: 'development', title: 'Development and deployment', file: 'development.md' },
  { slug: 'roadmap', title: 'Roadmap', file: 'roadmap.md' },
];

const markdown = new MarkdownIt({ html: false, linkify: true });
const escape = markdown.utils.escapeHtml;
const href = slug => '/docs/' + (slug ? slug + '/' : '');

export async function buildDocs({ sourceDir = join(projectRoot, 'docs'), outputDir = join(projectRoot, 'dist', 'docs'), pages = docsPages } = {}) {
  for (const page of pages) {
    const source = await readFile(join(sourceDir, page.file), 'utf8');
    const body = markdown.render(source);
    const navigation = pages.map(item => `<a href="${href(item.slug)}"${item.slug === page.slug ? ' aria-current="page"' : ''}>${escape(item.title)}</a>`).join('');
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>${escape(page.title)} | antwork docs</title><link rel="stylesheet" href="/docs/docs.css"></head>
<body><a class="skip-link" href="#content">Skip to content</a><div class="docs-shell">
<header class="docs-header"><a class="docs-brand" href="/docs/" aria-label="antwork documentation home"><span class="docs-mark">a</span><span>antwork <small>docs</small></span></a><a class="app-link" href="/#dashboard">Open app</a></header>
<div class="docs-layout"><nav class="docs-nav" aria-label="Documentation">${navigation}</nav><main id="content" class="docs-content"><article class="docs-prose">${body}</article><p class="docs-footer">antwork is a local-first beta. Your work history stays in this browser until you export it.</p></main></div>
</div></body></html>`;
    const target = join(outputDir, page.slug);
    await mkdir(target, { recursive: true });
    await writeFile(join(target, 'index.html'), html);
  }
}
