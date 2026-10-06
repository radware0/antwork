import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { setAppearance } from './theme-checks.mjs';

const setSlider = (slider, value) => slider.evaluate((input, next) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, next);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}, String(value));

export async function checkRunningLayoutReset(page, readData) {
  const before = (await readData()).timer;
  const move = page.getByRole('button', { name: 'Move timer', exact: true });
  const resize = page.getByRole('button', { name: 'Resize timer panel', exact: true });
  await move.focus(); await move.press('ArrowRight');
  await resize.focus(); await resize.press('ArrowRight');
  await page.getByRole('button', { name: 'Reset timer layout', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.timer-panel').offsetWidth === 640);
  await page.waitForTimeout(350);
  assert.deepEqual((await readData()).timer, before, 'layout reset preserves the running timer and every recording timestamp');
  assert.equal(await move.evaluate(el => el === document.activeElement), true, 'reset returns focus when its button disappears');
  const layout = await page.locator('.timer-panel').evaluate(el => {
    const panel = el.getBoundingClientRect(), stage = el.parentElement.getBoundingClientRect();
    return { dx: panel.x - stage.x - (stage.width - panel.width) / 2, dy: panel.y - stage.y - (stage.height - panel.height) / 2 };
  });
  assert.ok(Math.abs(layout.dx) < 2 && Math.abs(layout.dy) < 2, 'combined reset centers the active timer');
}

export async function checkTimerPresentation(page, readData, capture) {
  const dock = page.getByRole('navigation', { name: 'Main navigation' });
  await dock.getByRole('button', { name: 'Timers', exact: true }).click();
  const saved = (await readData()).timerPanel;
  const editor = page.getByRole('dialog', { name: 'Customize timer', exact: true });
  const open = () => page.getByRole('button', { name: 'Customize timer', exact: true }).click();
  const sample = async color => Buffer.from((await page.evaluate(value => {
    const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 240;
    const paint = canvas.getContext('2d'); paint.fillStyle = value; paint.fillRect(0, 0, 480, 240);
    return canvas.toDataURL('image/png').split(',')[1];
  }, color)), 'base64');
  const style = locator => locator.evaluate(el => ({
    background: getComputedStyle(el).backgroundColor,
    text: getComputedStyle(el).color,
    contrast: getComputedStyle(el.querySelector('.timer-panel-contrast')).backgroundColor,
  }));
  const baseline = await style(page.locator('.timer-panel'));
  for (const theme of ['white', 'black']) {
    await setAppearance(page, theme);
    assert.deepEqual(await style(page.locator('.timer-panel')), baseline, 'saved timer photos have identical surfaces in both themes');
    await open();
    assert.deepEqual(await style(editor.locator('.timer-custom-preview')), baseline, 'preview uses the finished timer treatment');
    assert.equal(baseline.contrast, 'rgba(0, 0, 0, 0.55)');
    for (const color of ['#ffffff', '#080808']) {
      await editor.getByLabel(/Upload image|Replace image/).setInputFiles({ name: 'contrast.png', mimeType: 'image/png', buffer: await sample(color) });
      await editor.locator('.timer-custom-preview-image').waitFor();
      for (const value of [0, 100]) {
        await setSlider(editor.getByRole('slider', { name: 'Image opacity' }), value);
        assert.equal(await editor.locator('.timer-custom-preview-image').evaluate(el => getComputedStyle(el).opacity), String(value / 100));
      }
      await setSlider(editor.getByRole('slider', { name: 'Blur' }), 24);
      assert.equal(await editor.locator('.timer-custom-preview-image').evaluate(el => getComputedStyle(el).filter), 'blur(24px)');
      if (capture) await capture(`timer-preview-${theme}-${color === '#ffffff' ? 'bright' : 'dark'}`);
    }
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
    await editor.waitFor({ state: 'hidden' });
    assert.deepEqual((await readData()).timerPanel, saved, 'contrast preview cancellation preserves the image and preferences');
  }
  const move = page.getByRole('button', { name: 'Move timer', exact: true });
  const resize = page.getByRole('button', { name: 'Resize timer panel', exact: true });
  await move.focus(); await move.press('ArrowRight');
  await resize.focus(); await resize.press('ArrowRight');
  await resize.press('Home');
  await page.waitForFunction(() => document.querySelector('.timer-panel').offsetWidth === 640);
  await page.waitForTimeout(350);
  assert.equal((await readData()).timerPanel.preferredWidth, 640, 'Home cancels the pending keyboard resize save');
  assert.equal((await readData()).timerPanel.preferredHeight, null);
  await move.focus(); await move.press('ArrowRight');
  await resize.focus(); await resize.press('ArrowRight');
  await page.waitForTimeout(350);
  await page.evaluate(() => { window.qaResetPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException('Test quota failure', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'Reset timer layout', exact: true }).click();
  await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
  assert.equal(await page.locator('.timer-panel').evaluate(el => el.offsetWidth), 640, 'failed persistence keeps the visible layout reset');
  await page.evaluate(() => { IDBObjectStore.prototype.put = window.qaResetPut; });
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.timer-size-error'));
  assert.equal((await readData()).timerPanel.preferredWidth, 640);
  assert.equal((await readData()).timerPanel.preferredHeight, null);
  assert.equal((await readData()).timerPanel.image, saved.image, 'reset never clears the background');
  const dismiss = page.getByRole('button', { name: 'Dismiss error' });
  if (await dismiss.count()) await dismiss.click();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(process.env.QA_BASE_URL ?? 'http://localhost:5173/');
    await page.getByRole('button', { name: 'Start lock-in' }).click();
    await page.getByRole('button', { name: 'Open Timer' }).click();
    const read = () => page.evaluate(() => new Promise(resolve => {
      const request = indexedDB.open('work-ledger', 1);
      request.onsuccess = () => {
        const db = request.result, get = db.transaction('documents').objectStore('documents').get('current');
        get.onsuccess = () => { resolve(get.result); db.close(); };
      };
    }));
    await checkRunningLayoutReset(page, read);
    console.log('Running timer layout reset passed.');
  } finally { await browser.close(); }
}
