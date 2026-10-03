import assert from 'node:assert/strict';

const rect = async locator => locator.boundingBox();
const closeTo = (actual, expected, message, tolerance = 2) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);

async function assertWithinStage(page) {
  const panel = await rect(page.locator('.timer-panel'));
  const stage = await rect(page.locator('.timer-drag-stage'));
  const dock = await rect(page.locator('.floating-nav'));
  assert.ok(panel.x >= stage.x - 1 && panel.y >= stage.y - 1, 'timer stays inside the workspace top and left edges');
  assert.ok(panel.x + panel.width <= stage.x + stage.width + 1, 'timer stays inside the workspace right edge');
  assert.ok(panel.y + panel.height <= Math.min(stage.y + stage.height, dock.y - 16) + 1, 'timer clears the dock by at least 16px');
  return { panel, stage };
}

export async function checkTimerInteractions(page, { draggable = true, verifyReturn = false } = {}) {
  const panel = page.locator('.timer-panel');
  const move = page.getByRole('button', { name: 'Move timer', exact: true });
  assert.equal(await panel.count(), 1, 'Timers has one work timer panel');

  if (!draggable) {
    assert.equal(await move.count(), 0, 'phone layout hides the desktop drag handle');
    const box = await rect(panel);
    assert.ok(box && box.width <= await page.evaluate(() => innerWidth), 'full-width timer fits a phone');
    return;
  }

  await move.waitFor();
  assert.equal(await move.count(), 1, 'desktop shows a dedicated drag handle');
  const instructionsId = await move.getAttribute('aria-describedby');
  assert.ok(instructionsId, 'drag handle points to keyboard instructions');
  assert.match(await page.locator(`[id="${instructionsId}"]`).textContent(), /Arrow keys move 16 pixels/);
  await page.waitForTimeout(220);
  const initial = await assertWithinStage(page);

  await move.focus();
  await page.keyboard.press('ArrowRight');
  closeTo((await rect(panel)).x - initial.panel.x, 16, 'right arrow moves the timer 16px');
  await page.keyboard.press('Shift+ArrowDown');
  closeTo((await rect(panel)).y - initial.panel.y, 64, 'Shift+Down moves the timer 64px');
  await page.keyboard.press('ArrowUp');
  closeTo((await rect(panel)).y - initial.panel.y, 48, 'Up moves the timer back 16px');
  assert.equal(await page.getByRole('button', { name: 'Reset timer position', exact: true }).count(), 1, 'moved timer exposes Reset');
  await page.getByRole('button', { name: 'Reset timer position', exact: true }).click();
  let current = await rect(panel);
  closeTo(current.x, initial.panel.x, 'Reset restores horizontal position');
  closeTo(current.y, initial.panel.y, 'Reset restores vertical position');

  const handle = await move.boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(initial.stage.x + initial.stage.width * .9, initial.stage.y + initial.stage.height * .9, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(220);
  let settled = await assertWithinStage(page);
  assert.ok(settled.panel.x > initial.panel.x + 40 && settled.panel.y > initial.panel.y + 20, `pointer can reposition the full timer panel: ${JSON.stringify({ before: initial, after: settled, viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight })) })}`);

  if (verifyReturn) {
    const savedPosition = settled.panel;
    const savedStage = settled.stage;
    const dock = page.getByRole('navigation', { name: 'Main navigation' });
    await dock.getByRole('button', { name: 'Dashboard', exact: true }).click();
    await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
    await dock.getByRole('button', { name: 'Timers', exact: true }).click();
    await page.getByRole('heading', { name: 'Timers', exact: true }).waitFor();
    await page.waitForTimeout(220);
    const restored = await assertWithinStage(page);
    const savedX = savedPosition.x - (savedStage.x + (savedStage.width - savedPosition.width) / 2);
    const savedY = savedPosition.y - (savedStage.y + (savedStage.height - savedPosition.height) / 2);
    const restoredX = restored.panel.x - (restored.stage.x + (restored.stage.width - restored.panel.width) / 2);
    const restoredY = restored.panel.y - (restored.stage.y + (restored.stage.height - restored.panel.height) / 2);
    closeTo(restoredX, savedX, 'timer placement survives page navigation', 3);
    closeTo(restoredY, savedY, 'timer placement survives page navigation', 3);
    settled = restored;
  }

  if (verifyReturn) {
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Timers', exact: true }).waitFor();
    await move.waitFor();
    await page.waitForTimeout(220);
    const reloaded = await assertWithinStage(page);
    closeTo(reloaded.panel.x, reloaded.stage.x + (reloaded.stage.width - reloaded.panel.width) / 2, 'reload centers the timer horizontally');
    closeTo(reloaded.panel.y, reloaded.stage.y + (reloaded.stage.height - reloaded.panel.height) / 2, 'reload centers the timer vertically');
  } else {
    await page.getByRole('button', { name: 'Reset timer position', exact: true }).click();
    current = await rect(panel);
    closeTo(current.x, initial.panel.x, 'pointer-dragged timer resets horizontally');
    closeTo(current.y, initial.panel.y, 'pointer-dragged timer resets vertically');
    await assertWithinStage(page);
  }
}
