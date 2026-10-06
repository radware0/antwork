import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const executablePath = process.env.QA_BROWSER_PATH ?? [chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(10000);
const base = process.env.QA_BASE_URL ?? 'http://localhost:5173/';
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await mkdir('.qa', { recursive: true });

async function checkPage() {
  await page.getByRole('heading', { name: 'Antwork available as app', exact: true }).waitFor();
  assert.equal(await page.getByRole('heading').count(), 1);
  assert.equal(await page.getByRole('link').count(), 2, 'Only download and Docs links are shown');
  assert.equal(await page.getByRole('button').count(), 0, 'App controls are absent');
  assert.equal(await page.getByRole('switch', { name: 'Dark appearance', exact: true }).count(), 1);
  assert.equal(await page.getByRole('link', { name: 'Download on GitHub' }).getAttribute('href'), 'https://github.com/radware0/antwork/releases/latest');
  assert.equal(await page.getByRole('contentinfo').innerText(), 'antwork 2026\nDocs');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
  const centered = await page.locator('.site-message').boundingBox();
  assert.ok(Math.abs(centered.x + centered.width / 2 - (await page.evaluate(() => innerWidth)) / 2) < 2, 'Message is horizontally centered');
  assert.ok(Math.abs(centered.y + centered.height / 2 - (await page.evaluate(() => innerHeight)) / 2) < 2, 'Message is vertically centered');
}

try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await checkPage();
  assert.deepEqual(await page.evaluate(() => indexedDB.databases()), [], 'Download page never opens the work-history database');
  const theme = page.getByRole('switch', { name: 'Dark appearance', exact: true });
  assert.equal(await theme.getAttribute('aria-checked'), 'true');
  await page.screenshot({ path: '.qa/site-black-desktop.png', fullPage: true });
  await theme.click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'white');
  assert.equal(await theme.getAttribute('aria-checked'), 'false');
  await page.reload({ waitUntil: 'networkidle' });
  await checkPage();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'white', 'Theme survives reload');
  await page.screenshot({ path: '.qa/site-white-desktop.png', fullPage: true });
  await theme.focus();
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'black');

  // Preserve a record left by the former web app, even when visiting its old routes.
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('work-ledger', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('documents');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('documents', 'readwrite');
      transaction.objectStore('documents').put({ note: 'Keep my existing history' }, 'current');
      transaction.oncomplete = () => { db.close(); resolve(); };
    };
  }));
  for (const suffix of ['#dashboard', '#timers', '?timer=popout']) {
    await page.goto(new URL(suffix, base).href, { waitUntil: 'networkidle' });
    await checkPage();
  }
  const saved = await page.evaluate(() => new Promise(resolve => {
    const request = indexedDB.open('work-ledger', 1);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('documents').objectStore('documents').get('current');
      get.onsuccess = () => { resolve(get.result); db.close(); };
    };
  }));
  assert.deepEqual(saved, { note: 'Keep my existing history' });

  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    for (const appearance of ['black', 'white']) {
      if (await page.evaluate(() => document.documentElement.dataset.theme) !== appearance) await theme.click();
      await page.waitForFunction(value => document.documentElement.dataset.theme === value, appearance);
      await checkPage();
      await page.screenshot({ path: `.qa/site-${appearance}-${viewport.width}.png`, fullPage: true });
    }
  }
  const colors = {};
  for (const appearance of ['black', 'white']) {
    await page.goto(base, { waitUntil: 'networkidle' });
    if (await page.evaluate(() => document.documentElement.dataset.theme) !== appearance) await theme.click();
    await page.waitForFunction(value => document.documentElement.dataset.theme === value, appearance);
    colors[appearance] = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.emulateMedia({ colorScheme: appearance === 'white' ? 'dark' : 'light' });
    await page.getByRole('link', { name: 'Docs', exact: true }).click();
    await page.getByRole('heading', { level: 1 }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), appearance, 'Docs follows the site theme even when the system uses the opposite theme');
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), colors[appearance]);
    assert.equal(await page.getByRole('link', { name: 'Home', exact: true }).getAttribute('href'), '/');
    await page.getByRole('navigation', { name: 'Documentation' }).getByRole('link', { name: 'Windows app', exact: true }).click();
    await page.getByRole('heading', { name: 'Windows app', exact: true }).waitFor();
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), appearance, 'Docs navigation and reload preserve the theme');
    await page.screenshot({ path: `.qa/docs-${appearance}.png`, fullPage: true });
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await checkPage();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), appearance);
  }
  const docsTab = await context.newPage();
  await docsTab.goto(new URL('/docs/', base).href, { waitUntil: 'networkidle' });
  await theme.click();
  await docsTab.waitForFunction(() => document.documentElement.dataset.theme === 'black');
  assert.equal(await docsTab.evaluate(() => getComputedStyle(document.body).backgroundColor), colors.black, 'Open Docs tabs update when the site theme changes');
  await docsTab.close();
  assert.deepEqual(errors, []);
  console.log(`Download page, both themes, keyboard toggle, responsive layout, preserved history, and Docs theme synchronization passed: ${base}`);
} finally {
  await browser.close();
}
