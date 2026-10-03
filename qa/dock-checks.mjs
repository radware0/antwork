import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const geometry = button => button.evaluate(element => {
  const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
  return { tile: rect(element), label: rect(element.querySelector('span')), icon: rect(element.querySelector('svg')) };
});
const near = (actual, expected, message, tolerance = .15) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);
const sameBox = (actual, expected, message) => { for (const field of ['x', 'y', 'width', 'height']) near(actual[field], expected[field], `${message} ${field}`); };

export async function checkDockInteractions(page, { staticIcons = false } = {}) {
  const dock = page.getByRole('navigation', { name: 'Main navigation' });
  const buttons = dock.getByRole('button');
  assert.equal(await buttons.count(), 5);
  for (const button of await buttons.all()) {
    await page.mouse.move(0, 0);
    await button.evaluate(element => element.blur());
    await page.waitForTimeout(350);
    const before = await geometry(button);
    const beforeFill = await button.evaluate(element => getComputedStyle(element).backgroundColor);
    assert.ok(before.tile.height >= 44, 'dock touch target remains at least 44px');
    const others = await buttons.evaluateAll(elements => elements.map(element => {
      const r = element.querySelector('svg').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
    }));
    const activeFill = await dock.locator('[aria-current=page]').evaluate(element => getComputedStyle(element).backgroundColor);
    await button.hover();
    await page.waitForTimeout(350);
    const hovered = await geometry(button);
    assert.equal(await button.evaluate(element => getComputedStyle(element).backgroundColor), beforeFill, 'hover keeps each tile background unchanged');
    sameBox(hovered.tile, before.tile, 'hover keeps the tile fixed');
    sameBox(hovered.label, before.label, 'hover keeps the label fixed');
    const dockBox = await dock.boundingBox();
    assert.ok(hovered.tile.x >= dockBox.x && hovered.tile.y >= dockBox.y, 'hover stays inside dock');
    assert.ok(hovered.tile.x + hovered.tile.width <= dockBox.x + dockBox.width, 'hover right edge stays inside dock');
    assert.equal(await dock.locator('[aria-current=page]').evaluate(element => getComputedStyle(element).backgroundColor), activeFill, 'active fill stays blue');
    if (staticIcons) sameBox(hovered.icon, before.icon, 'static hover icon');
    else {
      near(hovered.icon.width / before.icon.width, 1.08, 'hover icon scale', .003);
      near(hovered.icon.y + hovered.icon.height / 2, before.icon.y + before.icon.height / 2 - 2, 'hover icon lift');
    }
    for (let i = 0; i < await buttons.count(); i++) {
      const other = buttons.nth(i);
      if (await other.evaluate((element, target) => element.textContent === target, await button.textContent())) continue;
      sameBox((await geometry(other)).icon, others[i], 'neighboring icons remain still');
    }
    await page.mouse.move(0, 0);
    await page.waitForTimeout(350);
    await page.keyboard.press('Tab');
    await button.focus();
    await page.waitForTimeout(350);
    const focused = await geometry(button);
    assert.equal(await button.evaluate(element => getComputedStyle(element).backgroundColor), beforeFill, 'focus keeps each tile background unchanged');
    sameBox(focused.tile, before.tile, 'focus keeps the tile fixed');
    sameBox(focused.label, before.label, 'focus keeps the label fixed');
    if (staticIcons) sameBox(focused.icon, before.icon, 'static focus icon');
    else {
      near(focused.icon.width / before.icon.width, 1.08, 'focus icon scale', .003);
      near(focused.icon.y + focused.icon.height / 2, before.icon.y + before.icon.height / 2 - 2, 'focus icon lift');
    }
    assert.ok(await button.evaluate(element => element.matches(':focus-visible') && getComputedStyle(element).outlineStyle !== 'none'), 'keyboard focus stays visible');
    await button.press('Enter');
    assert.equal(await button.getAttribute('aria-current'), 'page', 'keyboard activates the destination');
    await page.getByRole('heading', { name: (await button.textContent()).trim(), exact: true }).waitFor();
    await button.evaluate(element => element.blur());
  }
  assert.notEqual(await dock.evaluate(element => getComputedStyle(element).overflow), 'hidden', 'dock does not clip focus indicators');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(process.env.QA_BASE_URL ?? 'http://localhost:5173/', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await checkDockInteractions(page);
    console.log('Dock interaction regression passed.');
  } finally { await browser.close(); }
}
