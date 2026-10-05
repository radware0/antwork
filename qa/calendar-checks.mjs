import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { createInitialData } from '../src/domain.ts';

const executablePath = process.env.QA_BROWSER_PATH ?? [chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Singapore', reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const readData = () => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('work-ledger', 1);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result;
    const get = db.transaction('documents').objectStore('documents').get('current');
    get.onsuccess = () => { resolve(get.result); db.close(); };
  };
}));
const cell = day => page.locator('.day-cell').filter({ has: page.locator('.day-number', { hasText: new RegExp('^' + day + '$') }) });
const mode = name => page.getByRole('group', { name: 'Calendar display', exact: true }).getByRole('button', { name, exact: true });
const rate = async name => {
  await page.getByRole('group', { name: 'Day rating', exact: true }).getByRole('button', { name, exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.day-rating-options button')?.disabled);
};
const assertCell = async (day, css, text) => {
  await page.waitForFunction(({ day, css, text }) => {
    const element = [...document.querySelectorAll('.day-cell')].find(el => el.querySelector('.day-number')?.textContent === String(day));
    return element?.classList.contains(css) && (text === undefined
      ? !element.querySelector('strong') && !/Good|Steady|Rough|Unrated/.test(element.textContent)
      : element.querySelector('strong')?.textContent === text);
  }, { day, css, text });
};

try {
  await page.clock.setFixedTime(new Date('2026-10-05T04:00:00Z'));
  await page.goto(process.env.QA_BASE_URL ?? 'http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
  const { dailyRatings: _ratings, calendarMode: _mode, ...oldData } = createInitialData('2026-10-01');
  oldData.onboarding.usernamePromptCompleted = true;
  oldData.sessions = [119, 120, 240].map((durationMinutes, index) => ({
    id: 'session-' + index, timing: 'duration', date: '2026-10-0' + (index + 3), durationMinutes,
    intervals: [], source: 'manual', questOccurrenceId: null, note: 'Preserve work', result: 'rough',
  }));
  oldData.journals = [{ date: '2026-10-05', text: 'Preserve journal', updatedAt: Date.parse('2026-10-05T04:00:00Z') }];
  await page.evaluate(data => new Promise(resolve => {
    const request = indexedDB.open('work-ledger', 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('documents', 'readwrite');
      tx.objectStore('documents').put(data, 'current');
      tx.oncomplete = () => { db.close(); resolve(); };
    };
  }), oldData);
  await page.reload({ waitUntil: 'networkidle' });
  await assertCell(5, 'neutral');
  assert.equal(await mode('Day quality').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.calendar-overview button.day-cell').count(), 0);
  assert.equal((await readData()).calendarMode, 'quality');
  await mode('Hours').click();
  await assertCell(3, 'hours-light', '2.0h');
  await assertCell(4, 'hours-medium', '2.0h');
  await assertCell(5, 'hours-dark', '4.0h');
  await assertCell(2, 'neutral', '0.0h');
  await page.getByRole('button', { name: 'Open Calendar', exact: true }).click();
  await page.getByRole('heading', { name: 'Calendar', exact: true }).waitFor();
  assert.equal(await mode('Hours').getAttribute('aria-pressed'), 'true');
  await mode('Day quality').click();
  await rate('Good');
  await assertCell(5, 'quality-good');
  assert.equal(await cell(5).locator('small').innerText(), '4.0h');
  await rate('Steady');
  await assertCell(5, 'quality-steady');
  await rate('Rough');
  await assertCell(5, 'quality-rough');
  await rate('Clear rating');
  await assertCell(5, 'neutral');
  await rate('Rough');
  await cell(2).click();
  await rate('Good');
  await assertCell(2, 'quality-good');
  assert.equal(await cell(2).locator('small').innerText(), '0.0h');
  await cell(3).click(); await rate('Steady');
  await cell(6).click();
  assert.equal(await page.getByRole('group', { name: 'Day rating', exact: true }).count(), 0);
  assert.equal(await cell(6).locator('strong').count(), 0);
  await page.reload({ waitUntil: 'networkidle' });
  await assertCell(2, 'quality-good');
  await assertCell(3, 'quality-steady');
  await assertCell(5, 'quality-rough');
  const saved = await readData();
  assert.deepEqual(saved.dailyRatings, { '2026-10-05': 'rough', '2026-10-02': 'good', '2026-10-03': 'steady' });
  assert.deepEqual(saved.journals, oldData.journals);
  assert.deepEqual(saved.sessions.map(({ note, result, durationMinutes }) => ({ note, result, durationMinutes })), oldData.sessions.map(({ note, result, durationMinutes }) => ({ note, result, durationMinutes })));
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Dashboard', exact: true }).click();
  await assertCell(2, 'quality-good');
  await mkdir('.qa', { recursive: true });
  for (const theme of ['dark', 'light']) {
    if (theme === 'light') {
      await page.getByRole('switch', { name: 'Dark appearance', exact: true }).click();
      await page.waitForFunction(() => document.documentElement.dataset.theme === 'white');
    }
    for (const width of [1440, 390, 320]) {
      console.log('Checking calendar layout:', theme, width);
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth).catch(async error => {
        console.log(await page.evaluate(() => ({ width: innerWidth, overflow: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => ({ tag: el.tagName, className: el.className, right: el.getBoundingClientRect().right })).slice(0, 12) })));
        await page.screenshot({ path: '.qa/calendar-overflow.png', fullPage: true });
        throw error;
      });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow at ' + width);
      assert.ok(await cell(1).locator('small').evaluate(el => el.getBoundingClientRect().right <= el.parentElement.getBoundingClientRect().right - 1), 'Hours fit at ' + width);
      await page.screenshot({ path: `.qa/calendar-quality-${theme}-${width}.png`, fullPage: true });
    }
  }
  await mode('Hours').click();
  await page.reload({ waitUntil: 'networkidle' });
  await assertCell(5, 'hours-dark', '4.0h');
  assert.equal(await mode('Hours').getAttribute('aria-pressed'), 'true');
  await mode('Day quality').click();
  await assertCell(5, 'quality-rough');
  await page.getByRole('button', { name: 'Open Calendar', exact: true }).click();
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
    await page.screenshot({ path: `.qa/calendar-details-${width}.png`, fullPage: true });
  }
  await mode('Hours').click();
  await assertCell(5, 'hours-dark', '4.0h');
  const fills = await Promise.all([3, 4, 5].map(day => cell(day).evaluate(el => getComputedStyle(el).backgroundColor)));
  assert.equal(new Set(fills).size, 3, 'Hours levels use visibly different fills');
  await page.screenshot({ path: '.qa/calendar-hours.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('Calendar browser checks passed: modes, ratings, persistence, legacy data, zero-work days, future dates, both themes and responsive layout.');
} finally {
  await context.close();
  await browser.close();
}
