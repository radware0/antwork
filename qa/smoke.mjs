import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { checkDockInteractions } from './dock-checks.mjs';
import { checkTimerInteractions } from './timer-checks.mjs';
import { checkThemeInteractions, setAppearance } from './theme-checks.mjs';
import { checkTimerPresentation, checkRunningLayoutReset } from './presentation-checks.mjs';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
await page.addInitScript(() => {
  window.qaSounds = [];
  window.qaSoundGains = [];
  class QAAudioContext {
    state = 'running'; currentTime = 0; destination = {};
    resume() { this.state = 'running'; return Promise.resolve(); }
    createOscillator() { return { type: 'sine', frequency: { setValueAtTime: value => window.qaSounds.push(value) }, connect(node) { return node; }, start() {}, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime(value) { if (value > .0001) window.qaSoundGains.push(value); } }, connect(node) { return node; } }; }
  }
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: QAAudioContext });
});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const base = process.env.QA_BASE_URL ?? 'http://localhost:5173/';
const dock = page.getByRole('navigation', { name: 'Main navigation' });
const nav = async name => { await dock.getByRole('button', { name, exact: true }).click(); await page.getByRole('heading', { name, exact: true }).waitFor(); };
const readData = () => page.evaluate(() => new Promise(resolve => {
  const request = indexedDB.open('work-ledger', 1);
  request.onsuccess = () => { const db = request.result; const get = db.transaction('documents').objectStore('documents').get('current'); get.onsuccess = () => { resolve(get.result); db.close(); }; };
}));
const putData = data => page.evaluate(value => new Promise(resolve => {
  const request = indexedDB.open('work-ledger', 1);
  request.onsuccess = () => { const db = request.result; const tx = db.transaction('documents', 'readwrite'); tx.objectStore('documents').put(value, 'current'); tx.oncomplete = () => { db.close(); new BroadcastChannel('work-ledger-data').postMessage('changed'); resolve(); }; };
}), data);
const dialog = name => page.getByRole('dialog', { name, exact: true });
const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'horizontal overflow at ' + page.url());
const screenshot = async name => { if (process.env.QA_SKIP_SCREENSHOTS) return; await page.screenshot({ path: '.qa/' + name + '.png', fullPage: true, animations: 'disabled' }); };
const capture = async name => { await page.waitForTimeout(220); await screenshot(name); };
const samplePng = async () => Buffer.from(await page.evaluate(() => {
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 240;
  const context = canvas.getContext('2d'); context.fillStyle = '#5273b8'; context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png').split(',')[1];
}), 'base64');

try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
  assert.equal((await readData()).schemaVersion, 5);
  assert.equal((await readData()).theme, 'black');
  assert.equal((await readData()).sessions.length, 0, 'workflow starts in an isolated empty browser context');
  assert.deepEqual((await readData()).timerPanel, { image: null, imageOpacity: 30, imageBlur: 0, preferredWidth: 640, preferredHeight: null });
  assert.deepEqual((await readData()).onboarding, { usernamePromptCompleted: false });
  assert.equal(await page.getByRole('switch', { name: 'Dark appearance', exact: true }).count(), 1);
  assert.deepEqual((await readData()).preferences, { interfaceSounds: true, timerAlarm: true });
  assert.equal(await page.evaluate(() => window.qaSounds.length), 0);
  assert.equal(await dialog('Pick your handle').count(), 0, 'Handle onboarding is deprecated');
  await checkThemeInteractions(page, readData);
  assert.equal(await page.getByRole('link', { name: 'Docs' }).count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Mute sounds' }).count(), 1);
  assert.equal(await page.locator('.calendar-overview button.day-cell').count(), 0);
  assert.equal(await page.locator('.dashboard-side .journal-panel').count(), 1);
  assert.equal(await dock.getByRole('button').count(), 5);
  assert.equal(await page.getByRole('button', { name: 'Start lock-in' }).count(), 1);
  await nav('Calendar'); await nav('Timers'); await page.goBack();
  await page.getByRole('heading', { name: 'Calendar', exact: true }).waitFor();
  await page.goForward(); await page.getByRole('heading', { name: 'Timers', exact: true }).waitFor();
  await checkTimerInteractions(page, { verifyReturn: true });
  await nav('Dashboard');
  await page.getByRole('button', { name: 'Start lock-in' }).click();
  await page.getByRole('button', { name: 'Open Timer' }).waitFor();
  const timerId = (await readData()).timer.id;
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal((await readData()).timer.id, timerId);
  await page.getByRole('button', { name: 'Open Timer' }).click();
  await checkRunningLayoutReset(page, readData);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Resume', exact: true }).waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal((await readData()).timer.runningSince, null);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Finish session' }).click();
  await dialog('Session complete').waitFor();
  await dialog('Session complete').getByLabel('Session note').fill('Precise timer session');
  await dialog('Session complete').getByRole('button', { name: 'Save session' }).click();
  await dialog('Session complete').waitFor({ state: 'hidden' });

  await nav('Profile');
  await page.getByRole('heading', { name: 'Career overview' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Edit profile' }).count(), 0);
  assert.equal(await page.locator('.identity-panel').count(), 0);
  const retained = await readData();
  await putData({ ...retained, profile: { ...retained.profile, name: 'Night Ant', username: 'night_ant', bio: 'Keep showing up.' } });
  const profileAvatarPng = await samplePng();
  await page.getByRole('button', { name: 'Create campaign', exact: true }).click();
  const campaign = dialog('Create campaign');
  await campaign.getByLabel('Title', { exact: true }).fill('Build a useful app');
  assert.equal(await campaign.getByLabel('Description').getAttribute('required'), null, 'campaign description is optional');
  await campaign.getByRole('button', { name: 'Create campaign', exact: true }).click();
  await campaign.waitFor({ state: 'hidden' });
  assert.equal((await readData()).campaigns[0].note, '', 'title-only campaign saves without description filler');
  const campaignRow = page.locator('.campaign-row').first();
  await campaignRow.getByRole('button', { name: 'Edit', exact: true }).click();
  await dialog('Edit campaign').getByLabel('Title', { exact: true }).fill('A deliberately long campaign title to test wrapping in compact cards');
  await dialog('Edit campaign').getByRole('button', { name: 'Save campaign' }).click();
  await campaignRow.getByRole('button', { name: 'Finish', exact: true }).click();
  await campaignRow.getByRole('button', { name: 'Reopen', exact: true }).click();

  await nav('Timers');
  await page.getByRole('button', { name: 'Customize timer', exact: true }).click();
  const customizeTimer = dialog('Customize timer');
  await customizeTimer.waitFor();
  await customizeTimer.getByLabel(/Upload image/).setInputFiles({ name: 'wrong.gif', mimeType: 'image/gif', buffer: Buffer.from('not an image') });
  await customizeTimer.getByRole('alert').waitFor();
  await customizeTimer.getByLabel(/Upload image/).setInputFiles({ name: 'timer-background.png', mimeType: 'image/png', buffer: profileAvatarPng });
  await customizeTimer.locator('.timer-custom-preview-image').waitFor();
  const opacity = customizeTimer.getByRole('slider', { name: 'Image opacity' });
  await opacity.evaluate((input, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }, '46');
  assert.equal(await opacity.inputValue(), '46');
  const blur = customizeTimer.getByRole('slider', { name: 'Blur' });
  await blur.evaluate((input, value) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); }, '5');
  assert.equal(await blur.inputValue(), '5');
  await customizeTimer.getByRole('button', { name: 'Save appearance' }).click();
  await customizeTimer.waitFor({ state: 'hidden' });
  const savedTimerStyle = (await readData()).timerPanel;
  assert.ok(savedTimerStyle.image?.startsWith('data:image/webp;base64,'));
  assert.equal(savedTimerStyle.imageOpacity, 46);
  assert.equal(savedTimerStyle.imageBlur, 5);
  assert.ok((await page.locator('.timer-panel-image').count()) === 1, 'timer background appears on Timers');
  await checkTimerPresentation(page, readData, process.env.QA_SKIP_SCREENSHOTS ? null : capture);
  await page.getByRole('button', { name: 'Customize timer', exact: true }).click();
  await customizeTimer.getByRole('button', { name: 'Remove image' }).click();
  await customizeTimer.getByRole('slider', { name: 'Image opacity' }).evaluate((input) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '70'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await customizeTimer.getByRole('button', { name: 'Cancel', exact: true }).click();
  await customizeTimer.waitFor({ state: 'hidden' });
  assert.deepEqual((await readData()).timerPanel, savedTimerStyle, 'Cancel discards image and slider changes');

  assert.equal(await page.getByRole('button', { name: 'Change appearance' }).count(), 0);
  await setAppearance(page, 'white');
  assert.equal((await readData()).theme, 'white');
  await setAppearance(page, 'black');
  assert.equal((await readData()).theme, 'black');
  assert.deepEqual((await readData()).preferences, { interfaceSounds: true, timerAlarm: true });
  await page.getByRole('button', { name: 'Mute sounds' }).click();
  await page.getByRole('button', { name: 'Unmute sounds' }).waitFor();
  assert.deepEqual((await readData()).preferences, { interfaceSounds: false, timerAlarm: false });
  await page.getByRole('button', { name: 'Unmute sounds' }).click();
  await page.getByRole('button', { name: 'Mute sounds' }).waitFor();
  assert.deepEqual((await readData()).preferences, { interfaceSounds: true, timerAlarm: true });

  await nav('Work Hours');
  assert.ok(await page.evaluate(() => window.qaSounds.length > 3), 'enabled navigation sound plays');
  assert.ok(await page.evaluate(() => window.qaSoundGains.includes(.072)), 'interface clicks use the louder gain');
  assert.equal(await page.locator('.manual-entry').count(), 0);
  await page.locator('.antwork-chart svg').first().waitFor();
  assert.equal(await page.locator('.hours-area .sr-only li').count(), 30);
  await page.evaluate(() => { window.qaChartArt = document.querySelector('.antwork-chart'); });
  const precise = (await readData()).sessions[0];
  await page.locator('.history-item').first().getByRole('button', { name: 'Edit', exact: true }).click();
  const edit = dialog('Edit session');
  assert.match(await edit.locator('input[type=datetime-local]').first().inputValue(), /^\d{4}-\d\d-\d\dT\d\d:\d\d$/);
  await edit.getByLabel('Session note').fill('Precise note-only correction');
  await edit.getByRole('button', { name: 'Save correction' }).click(); await edit.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => window.qaChartArt?.isSameNode(document.querySelector('.antwork-chart'))), true, 'history updates do not remount the chart');
  assert.deepEqual((await readData()).sessions[0].intervals, precise.intervals);
  await page.locator('.history-item').first().getByRole('button', { name: 'Edit', exact: true }).click();
  const correctedEnd = await edit.getByLabel('End', { exact: true }).first().inputValue();
  const newEnd = correctedEnd.slice(0, 10) + 'T23:59';
  await edit.getByLabel('End', { exact: true }).first().fill(newEnd);
  await edit.getByRole('button', { name: 'Save correction' }).click(); await edit.waitFor({ state: 'hidden' });
  assert.equal((await readData()).sessions[0].intervals[0].end, new Date(newEnd).getTime());
  assert.equal((await readData()).sessions[0].intervals[0].start, precise.intervals[0].start);
  await page.getByRole('button', { name: 'Add work hours', exact: true }).click();
  const add = dialog('Add work hours');
  assert.equal(await add.getByLabel('Hours', { exact: true }).inputValue(), '');
  await add.getByRole('button', { name: 'Save hours' }).click(); await add.getByRole('alert').waitFor();
  await add.getByLabel('Hours', { exact: true }).fill('2');
  await add.locator('summary').click();
  await add.getByLabel('Campaign').selectOption({ index: 1 });
  await add.getByLabel('How did it feel?').selectOption('strong');
  await add.getByLabel('Session note').fill('Two hours, no invented timestamps');
  await add.getByRole('button', { name: 'Save hours' }).click(); await add.waitFor({ state: 'hidden' });
  const duration = (await readData()).sessions.find(item => item.timing === 'duration');
  assert.equal(duration.durationMinutes, 120); assert.deepEqual(duration.intervals, []);
  const row = page.locator('.history-item').filter({ hasText: 'Two hours, no invented timestamps' });
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  await edit.getByLabel('Minutes', { exact: true }).fill('15');
  await edit.getByRole('button', { name: 'Save correction' }).click(); await edit.waitFor({ state: 'hidden' });
  assert.equal((await readData()).sessions.find(item => item.id === duration.id).durationMinutes, 135);
  await page.getByRole('button', { name: 'Add work hours', exact: true }).click();
  await add.getByRole('button', { name: 'Use start and end times' }).click();
  const date = duration.date;
  await add.getByLabel('Start', { exact: true }).fill(date + 'T10:00');
  await add.getByLabel('End', { exact: true }).fill(date + 'T09:00');
  await add.getByRole('button', { name: 'Save hours' }).click(); await add.getByRole('alert').waitFor();
  await add.getByLabel('End', { exact: true }).fill(date + 'T11:00');
  await add.getByRole('button', { name: 'Save hours' }).click(); await add.waitFor({ state: 'hidden' });

  await nav('Calendar');
  await page.locator('.calendar-interactive button.day-cell').first().click();
  await page.getByRole('button', { name: 'Add work hours', exact: true }).click();
  assert.equal((await add.getByLabel('Date', { exact: true }).inputValue()).slice(-2), '01');
  await add.getByRole('button', { name: 'Cancel', exact: true }).click(); await add.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  const journal = page.locator('.journal-panel');
  assert.equal(await journal.getByText('Saved on this device').count(), 0);
  await journal.getByRole('button', { name: 'Write note' }).click();
  const note = dialog('Edit journal');
  await note.getByLabel('Daily journal').fill('One useful reflection.\n' + 'Long journal text '.repeat(40));
  await page.mouse.click(5, 5);
  assert.equal(await note.isVisible(), true, 'backdrop never discards a draft');
  await note.getByRole('button', { name: 'Save note' }).click(); await note.waitFor({ state: 'hidden' });
  await journal.getByRole('button', { name: 'Read journal' }).click();
  assert.ok(await dialog('Journal').isVisible());
  await page.keyboard.press('Escape'); await dialog('Journal').waitFor({ state: 'hidden' });
  await journal.getByRole('button', { name: 'Edit', exact: true }).click();
  await note.getByLabel('Daily journal').fill('Discard');
  await note.getByRole('button', { name: 'Cancel', exact: true }).click(); await note.waitFor({ state: 'hidden' });
  assert.match((await readData()).journals[0].text, /One useful/);

  // A completed countdown must wait for the journal modal to close.
  await journal.getByRole('button', { name: 'Edit', exact: true }).click();
  const countdownData = await readData();
  countdownData.timer = { id: 'queued-countdown', mode: 'countdown', durationMs: 60000, accumulatedMs: 0, intervals: [], runningSince: Date.now() - 61000, questOccurrenceId: null, campaignId: null };
  const alarmStart = await page.evaluate(() => window.qaSounds.length);
  await putData(countdownData);
  await page.waitForFunction(start => window.qaSounds.length >= start + 2, alarmStart);
  assert.equal(await page.evaluate(start => window.qaSounds.slice(start).filter(value => value === 660 || value === 880).length, alarmStart), 2, 'settled countdown emits one two-note alarm');
  assert.deepEqual(await page.evaluate(() => window.qaSoundGains.filter(value => value !== .072)), [.18, .14], 'only one louder two-note alarm plays');
  await page.waitForFunction(() => document.querySelectorAll('dialog').length === 2);
  assert.equal(await page.locator('dialog[open]').count(), 1);
  assert.equal(await note.isVisible(), true);
  await note.getByRole('button', { name: 'Cancel', exact: true }).click();
  await dialog('Session complete').waitFor();
  await page.evaluate(() => { window.qaPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException('Test quota failure', 'QuotaExceededError'); }; });
  await page.keyboard.press('Escape');
  await dialog('Session complete').getByRole('alert').waitFor();
  await page.waitForTimeout(250);
  assert.equal(await dialog('Session complete').evaluate(el => Number(getComputedStyle(el).opacity)), 1, 'failed dismissal restores the visible modal');
  await page.evaluate(() => { IDBObjectStore.prototype.put = window.qaPut; });
  await dialog('Session complete').getByRole('button', { name: 'Save session' }).click();
  await dialog('Session complete').waitFor({ state: 'hidden' });
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => window.qaSounds.length), 0, 'completed reviews do not replay an alarm after reload');

  // Fail a save without losing the editor draft.
  await journal.getByRole('button', { name: 'Edit', exact: true }).click();
  await note.getByLabel('Daily journal').fill('Retained after failure');
  await page.evaluate(() => { window.qaPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException('Test quota failure', 'QuotaExceededError'); }; });
  await note.getByRole('button', { name: 'Save changes' }).click(); await note.getByRole('alert').waitFor();
  assert.equal(await note.getByLabel('Daily journal').inputValue(), 'Retained after failure');
  await page.evaluate(() => { IDBObjectStore.prototype.put = window.qaPut; });
  await note.getByRole('button', { name: 'Save changes' }).click(); await note.waitFor({ state: 'hidden' });
  await nav('Dashboard');
  await page.locator('.journal-panel').getByRole('button', { name: 'Edit', exact: true }).click();
  await note.getByLabel('Daily journal').fill('one\ntwo\nthree\nfour');
  await note.getByRole('button', { name: 'Save changes' }).click(); await note.waitFor({ state: 'hidden' });
  await page.locator('.journal-panel').getByRole('button', { name: 'Read journal' }).waitFor();

  for (const theme of ['white', 'black']) {
    await setAppearance(page, theme);
    assert.equal((await readData()).theme, theme);
    for (const [width, height] of [[1440, 900], [1366, 768], [1100, 820], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await checkDockInteractions(page);
      for (const name of ['Dashboard', 'Timers', 'Calendar', 'Work Hours', 'Profile']) {
        await nav(name); await noOverflow();
        if (name === 'Dashboard') assert.ok(await page.locator('.trend-compact .hours-area').evaluate(el => el.getBoundingClientRect().height >= 70), 'lazy Dashboard chart reserves its height');
        if (name === 'Timers') {
          await checkTimerInteractions(page, { draggable: width >= 900 });
          assert.equal(await page.locator('.timer-panel-image').count(), 1, 'saved timer background remains visible in both layouts');
          if (width < 900) assert.equal(await page.getByRole('button', { name: 'Resize timer panel', exact: true }).count(), 0, 'saved background does not make the phone panel resizable');
        }
        if (name === 'Work Hours') {
          const chartValues = await page.locator('.hours-area .sr-only li').allTextContents();
          assert.equal(chartValues.length, 30);
          assert.ok(chartValues.every(value => / \d+(?:\.\d+)? hours?$/.test(value)), 'accessible chart values use hours');
          assert.ok(chartValues.every(value => !value.includes('minutes')), 'accessible chart values never say minutes');
        }
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
        assert.ok(await page.evaluate(() => document.querySelector('.page-transition').getBoundingClientRect().bottom < document.querySelector('.floating-nav').getBoundingClientRect().top), 'dock clears final page content');
        await page.evaluate(() => scrollTo(0, 0));
        await capture(name.toLowerCase().replace(' ', '-') + '-' + theme + '-' + width);
      }
    }
  }
  await nav('Timers');
  await page.getByRole('button', { name: 'Customize timer', exact: true }).click();
  await customizeTimer.getByRole('button', { name: 'Remove image' }).click();
  await customizeTimer.getByRole('button', { name: 'Save appearance' }).click();
  await customizeTimer.waitFor({ state: 'hidden' });
  assert.equal((await readData()).timerPanel.image, null, 'saved removal clears the background');

  await page.setViewportSize({ width: 1366, height: 768 }); await nav('Dashboard');
  for (let i = 0; i < 12 && await page.locator('.calendar-overview .day-cell').count() !== 42; i++) await page.getByRole('button', { name: 'Next month' }).click();
  assert.equal(await page.locator('.calendar-overview .day-cell').count(), 42);
  await capture('dashboard-six-row-1366');
  const month = await page.locator('.calendar-heading h2').innerText();
  await page.getByRole('button', { name: 'Open Calendar' }).click();
  assert.equal(await page.locator('.calendar-heading h2').innerText(), month);
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await checkDockInteractions(page, { staticIcons: true });
  await nav('Work Hours');
  await page.locator('.antwork-chart svg').first().waitFor();
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
  await dock.getByRole('button', { name: 'Profile' }).hover();
  assert.equal(await dock.getByRole('button', { name: 'Profile' }).evaluate(el => getComputedStyle(el).transform), 'none');

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const touchPage = await touchContext.newPage();
  touchPage.on('pageerror', error => errors.push(error.message));
  await touchPage.goto(base, { waitUntil: 'networkidle' });
  await touchPage.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
  assert.equal(await touchPage.evaluate(() => matchMedia('(hover: none)').matches), true);
  assert.equal(await touchPage.getByRole('dialog', { name: 'Pick your handle' }).count(), 0);
  await checkDockInteractions(touchPage, { staticIcons: true });
  for (const name of ['Dashboard', 'Timers', 'Calendar', 'Work Hours', 'Profile']) {
    const touchButton = touchPage.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true });
    await touchButton.tap();
    await touchPage.getByRole('heading', { name, exact: true }).waitFor();
    if (name === 'Timers') await checkTimerInteractions(touchPage, { draggable: false });
    assert.equal(await touchButton.locator('svg').evaluate(element => getComputedStyle(element).transform), 'none', 'touch navigation does not magnify icons');
  }
  await touchContext.close();



  await nav('Profile');
  const backup = await readData();
  await page.locator('input[type=file]').setInputFiles({ name: 'roundtrip.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await dialog('Replace local history').getByRole('button', { name: 'Replace local history', exact: true }).click();
  await dialog('Replace local history').waitFor({ state: 'hidden' });
  assert.deepEqual(await readData(), backup);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  assert.match((await downloadPromise).suggestedFilename(), /^antwork-/);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal((await readData()).profile.username, 'night_ant');

  await page.getByRole('button', { name: 'Mute sounds' }).click();
  await page.getByRole('button', { name: 'Unmute sounds' }).waitFor();
  await page.waitForTimeout(120);
  const mutedCount = await page.evaluate(() => window.qaSounds.length);
  await nav('Dashboard');
  assert.equal(await page.evaluate(() => window.qaSounds.length), mutedCount, 'muted interface does not synthesize navigation audio');

  // Delay the first IndexedDB read: the startup screen exists only while actual work is pending.
  const slowContext = await browser.newContext();
  const slow = await slowContext.newPage();
  await slow.addInitScript(() => { const open = indexedDB.open.bind(indexedDB); indexedDB.open = (...args) => {
    const proxy = {}; setTimeout(() => { const real = open(...args); for (const key of ['onupgradeneeded', 'onsuccess', 'onerror']) real[key] = event => { proxy.result = real.result; proxy.error = real.error; proxy[key]?.(event); }; }, 700); return proxy;
  }; });
  await slow.goto(base);
  await slow.locator('[aria-busy=true]').waitFor();
  assert.match(await slow.locator('.startup-title').evaluate(element => getComputedStyle(element).fontFamily), /Rajdhani/i);
  await slow.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
  assert.equal(await slow.locator('.startup-screen').count(), 0);
  await slowContext.close();

  const errorContext = await browser.newContext();
  const failed = await errorContext.newPage();
  await failed.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { configurable: true, value: { open() { throw new Error('Storage blocked for QA'); } } }); });
  await failed.goto(base);
  await failed.getByRole('alert').waitFor();
  assert.equal(await failed.getByRole('button', { name: 'Reload app' }).count(), 1);
  await errorContext.close();
  assert.deepEqual(errors, []);
  const docs = await context.newPage();
  await docs.goto(new URL('/docs/', base).toString());
  await docs.getByRole('heading', { name: 'Work that feels worth returning to' }).waitFor();
  await docs.getByRole('navigation', { name: 'Documentation' }).getByRole('link', { name: 'Decision history' }).click();
  await docs.getByRole('heading', { name: 'Decision history' }).waitFor();
  assert.ok(await docs.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await docs.close();
  console.log(JSON.stringify({ result: 'pass', themes: 2, viewports: 4, pages: 5, errors }));
} catch (error) { await screenshot('failure'); throw error; }
finally { await browser.close(); }
