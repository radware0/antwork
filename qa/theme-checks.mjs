import assert from 'node:assert/strict';

export async function setAppearance(page, theme) {
  const control = page.getByRole('switch', { name: 'Dark appearance', exact: true });
  if (await control.isChecked() !== (theme === 'black')) await control.click();
  await waitForAppearance(page, theme);
}

async function waitForAppearance(page, theme) {
  await page.waitForFunction(value => document.documentElement.dataset.theme === value && !document.querySelector('.liquid-theme-toggle')?.disabled, theme);
}

export async function checkThemeInteractions(page, readData) {
  const control = page.getByRole('switch', { name: 'Dark appearance', exact: true });
  await setAppearance(page, 'white');
  await control.focus(); await control.press('Enter'); await waitForAppearance(page, 'black');
  await control.press('Space'); await waitForAppearance(page, 'white');
  const box = await control.boundingBox();
  assert.equal(box.width, 92); assert.equal(box.height, 46);
  await page.mouse.move(box.x + 23, box.y + 23); await page.mouse.down();
  await page.mouse.move(box.x + 25, box.y + 23);
  await page.mouse.move(box.x + 78, box.y + 23, { steps: 4 });
  assert.equal((await readData()).theme, 'white', 'theme drag does not save before release');
  await page.mouse.up(); await waitForAppearance(page, 'black');
  await control.dispatchEvent('pointerdown', { pointerId: 77, pointerType: 'mouse', button: 0, clientX: box.x + 69, clientY: box.y + 23 });
  await control.dispatchEvent('pointermove', { pointerId: 77, pointerType: 'mouse', clientX: box.x + 67, clientY: box.y + 23 });
  await control.dispatchEvent('pointermove', { pointerId: 77, pointerType: 'mouse', clientX: box.x + 8, clientY: box.y + 23 });
  await control.dispatchEvent('pointercancel', { pointerId: 77, pointerType: 'mouse' });
  assert.equal((await readData()).theme, 'black', 'cancelled drag preserves the saved appearance');
  await page.evaluate(() => { window.qaThemePut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException('Test quota failure', 'QuotaExceededError'); }; });
  await control.click();
  await page.getByRole('button', { name: 'Dismiss error' }).waitFor();
  await waitForAppearance(page, 'black');
  assert.equal(await control.isChecked(), true, 'failed theme save restores the controlled switch');
  assert.equal((await readData()).theme, 'black');
  await page.evaluate(() => { IDBObjectStore.prototype.put = window.qaThemePut; });
  await page.getByRole('button', { name: 'Dismiss error' }).click();
  await setAppearance(page, 'white');
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal((await readData()).theme, 'white', 'the liquid switch theme survives reload');
  assert.equal(await control.isChecked(), false);
  await setAppearance(page, 'black');
}
