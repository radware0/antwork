import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron } from 'playwright-core';

const directory = path.resolve('.qa', `desktop-${randomUUID()}`);
const profile = path.join(directory, 'profile');
const downloads = path.join(directory, 'downloads');
await mkdir(downloads, { recursive: true });
const env = { ...process.env, ANTWORK_TEST_USER_DATA_DIR: profile, ANTWORK_TEST_DOWNLOAD_DIR: downloads };
delete env.ELECTRON_RUN_AS_NODE;
const executable = process.env.ANTWORK_QA_EXECUTABLE;
const errors = [];
const remoteRequests = [];
let app;
let page;

async function launch() {
  const args = ['--no-error-dialogs'];
  app = await _electron.launch({ ...(executable ? { executablePath: path.resolve(executable), args } : { args: [...args, '.'] }), env, timeout: 30000 });
  app.process().stderr.on('data', data => { if (/Could not|Error:/.test(data.toString())) console.error(data.toString().trim()); });
  page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  app.context().on('request', request => { if (/^https?:/.test(request.url())) remoteRequests.push(request.url()); });
  await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
  // Show the isolated QA window off-screen so Windows emits real visibility transitions.
  await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.setPosition(-10000, -10000); window.showInactive(); });
  await app.context().setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
  console.log('Desktop opened offline.');
}

const readData = () => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('work-ledger', 1);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result;
    const get = db.transaction('documents').objectStore('documents').get('current');
    get.onsuccess = () => { resolve(get.result); db.close(); };
    get.onerror = () => { reject(get.error); db.close(); };
  };
}));

const putData = value => page.evaluate(data => new Promise((resolve, reject) => {
  const request = indexedDB.open('work-ledger', 1);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const db = request.result;
    const tx = db.transaction('documents', 'readwrite');
    tx.objectStore('documents').put(data, 'current');
    tx.oncomplete = () => { db.close(); const channel = new BroadcastChannel('work-ledger-data'); channel.postMessage('changed'); channel.close(); resolve(); };
    tx.onerror = () => { reject(tx.error); db.close(); };
  };
}), value);

async function until(check, label) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${label}`);
}

async function checkTimerHitTargets(popup) {
  const targets = await popup.evaluate(() => {
    const center = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; };
    const buttons = [...document.querySelectorAll('.timer-controls button')].map(button => button.getBoundingClientRect());
    return [
      ...[[8, 8], [innerWidth - 9, 8], [8, innerHeight - 9], [innerWidth - 9, innerHeight - 9], [8, innerHeight / 2], [innerWidth - 9, innerHeight / 2]].map(([x, y]) => ({ x: Math.round(x), y: Math.round(y), hit: 2 })),
      { ...center('.timer-display'), hit: 2 },
      ...(buttons.length > 1 ? [{ x: Math.round((buttons[0].right + buttons[1].left) / 2), y: Math.round(buttons[0].y + buttons[0].height / 2), hit: 2 }] : []),
      ...[...document.querySelectorAll('.timer-panel button, .timer-panel select, .timer-panel input')].filter(el => el.getClientRects().length).map(el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), hit: 1 }; }),
      // Windows' frameless thick-frame resize gutters sit outside the content.
      ...[[-2, -2, 13], [innerWidth + 1, -2, 14], [-2, innerHeight + 1, 16], [innerWidth + 1, innerHeight + 1, 17], [-2, innerHeight / 2, 10], [innerWidth + 1, innerHeight / 2, 11], [innerWidth / 2, -2, 12], [innerWidth / 2, innerHeight + 1, 15]].map(([x, y, hit]) => ({ x: Math.round(x), y: Math.round(y), hit })),
    ];
  });
  await checkWindowHitTargets(popup, targets);
}

async function checkWindowHitTargets(windowPage, targets) {
  const native = await app.evaluate(({ BrowserWindow, screen }, { url, targets }) => {
    const window = BrowserWindow.getAllWindows().find(window => window.webContents.getURL() === url);
    const bounds = window.getContentBounds();
    return { handle: window.getNativeWindowHandle().readBigUInt64LE().toString(), points: targets.map(({ x, y }) => screen.dipToScreenPoint({ x: bounds.x + x, y: bounds.y + y })) };
  }, { url: windowPage.url(), targets });
  // WM_NCHITTEST checks Windows' actual drag targets without moving the pointer.
  const hits = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `
    Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class AntworkHitTest { [DllImport("user32.dll", EntryPoint="SendMessageW")] public static extern IntPtr SendMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam); }';
    @(${native.points.map(({ x, y }) => (x & 0xffff) + ((y & 0xffff) * 65536)).join(',')}) | ForEach-Object { [AntworkHitTest]::SendMessage([IntPtr]${native.handle}, 0x84, [IntPtr]::Zero, [IntPtr]$_).ToInt32() }
  `], { windowsHide: true, timeout: 15000, encoding: 'utf8' }).trim().split(/\s+/).map(Number);
  assert.deepEqual(hits, targets.map(({ hit }) => hit), `Windows drag and control targets at ${await windowPage.evaluate(() => `${innerWidth}×${innerHeight}`)}`);
}

const timerMatches = check => until(async () => { const data = await readData(); return check(data.timer, data) && data; }, 'timer state');
const nav = async name => {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true }).click();
  await page.getByRole('heading', { name, exact: true }).waitFor();
};
const closeNormally = async () => {
  // Show the main window before testing its custom close button.
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find(window => !window.webContents.getURL().includes('timer=popout'));
    window.setPosition(40, 40); window.showInactive();
  });
  const closed = app.waitForEvent('close', { timeout: 15000 });
  await page.getByRole('button', { name: 'Close antwork', exact: true }).click();
  await closed;
  app = null;
};

try {
  await launch();
  assert.equal(await page.getByRole('dialog', { name: 'Pick your handle' }).count(), 0);
  assert.deepEqual(await page.locator('.app-shell').evaluate(el => ({ left: el.getBoundingClientRect().left, fillsViewport: el.getBoundingClientRect().width === document.documentElement.clientWidth, border: getComputedStyle(el).borderTopWidth })), { left: 0, fillsViewport: true, border: '0px' });
  assert.deepEqual(await page.evaluate(() => ({ node: typeof window.require, process: typeof window.process, bridge: typeof window.antworkDesktop, origin: location.origin })), { node: 'undefined', process: 'undefined', bridge: 'object', origin: 'antwork://app' });
  assert.deepEqual(await app.evaluate(({ BrowserWindow }) => {
    const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return { sandbox: preferences.sandbox, contextIsolation: preferences.contextIsolation, nodeIntegration: preferences.nodeIntegration, backgroundThrottling: BrowserWindow.getAllWindows()[0].webContents.getBackgroundThrottling() };
  }), { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: true });
  assert.equal(await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    return JSON.stringify(window.getBounds()) === JSON.stringify(window.getContentBounds());
  }), true, 'The main window uses the custom title bar');
  await checkWindowHitTargets(page, await page.evaluate(() => {
    const center = (el, hit) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), hit }; };
    return [center(document.querySelector('.brand'), 2), { x: 8, y: 14, hit: 2 }, ...[...document.querySelectorAll('.app-topbar button, .app-topbar a')].map(el => center(el, 1))];
  }));
  await page.evaluate(() => window.antworkDesktop.controlWindow('unsupported-action'));
  await page.getByRole('button', { name: 'Maximize antwork', exact: true }).click();
  await until(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized()), 'maximized main window');
  await page.getByRole('button', { name: 'Restore antwork', exact: true }).press('Enter');
  await until(() => app.evaluate(({ BrowserWindow }) => !BrowserWindow.getAllWindows()[0].isMaximized()), 'restored main window');
  await page.getByRole('button', { name: 'Maximize antwork', exact: true }).waitFor();
  await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.setPosition(-10000, -10000); window.showInactive(); });
  for (const name of ['Timers', 'Calendar', 'Work Hours', 'Profile', 'Dashboard']) {
    await nav(name);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal overflow: ${name}`);
  }
  await page.screenshot({ path: path.join(directory, 'dashboard.png'), fullPage: true });

  await page.getByRole('button', { name: 'Start lock-in' }).click();
  const started = await timerMatches(timer => timer?.runningSince != null);
  await page.getByRole('button', { name: 'Minimize antwork', exact: true }).click();
  await app.evaluate(({ powerMonitor }) => powerMonitor.emit('lock-screen'));
  await until(async () => !(await page.evaluate(() => window.antworkDesktop.isWindowVisible())), 'hidden window');
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false, 'Minimize hides the app into the tray');
  const hiddenClock = await page.locator('.timer-status-clock').textContent();
  await new Promise(resolve => setTimeout(resolve, 1500));
  assert.equal(await page.locator('.timer-status-clock').textContent(), hiddenClock, 'The hidden main window stops redrawing its clock');
  assert.equal((await readData()).timer.runningSince, started.timer.runningSince, 'Minimize and screen lock keep the timer running');
  await app.evaluate(({ BrowserWindow, powerMonitor }) => { BrowserWindow.getAllWindows()[0].restore(); powerMonitor.emit('unlock-screen'); });

  await app.evaluate(({ app }) => app.emit('activate'));
  await until(() => page.evaluate(() => window.antworkDesktop.isWindowVisible()), 'visible window');
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), true, 'The restore action shows the app again');

  const docsPromise = app.waitForEvent('window');
  await page.getByRole('link', { name: 'Docs', exact: true }).click({ noWaitAfter: true });
  const docs = await docsPromise;
  await docs.waitForURL('antwork://app/docs/');
  assert.ok(await docs.getByRole('heading').count() > 0, 'Documentation is bundled offline');
  assert.equal(await docs.evaluate(() => typeof window.antworkDesktop), 'undefined', 'Documentation has no privileged bridge');
  assert.ok(page.url().startsWith('antwork://app/index.html'), 'Opening documentation preserves the app renderer');
  assert.equal((await readData()).timer.runningSince, started.timer.runningSince);
  await docs.close();
  console.log('Screens, renderer isolation, minimize, lock, and offline docs passed.');

  await nav('Timers');
  const popupPromise = app.waitForEvent('window');
  await page.getByRole('button', { name: 'Pop out timer' }).click();
  const popup = await popupPromise;
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().includes('timer=popout'));
    window.setPosition(40, 40); window.showInactive();
  });
  popup.on('pageerror', error => errors.push(error.message));
  await popup.getByRole('heading', { name: 'Work timer' }).waitFor();
  assert.equal(await popup.getByRole('navigation').count(), 0);
  assert.equal(await popup.locator('.timer-history-hint').count(), 0);
  const fillsTimerWindow = async () => {
    assert.ok(await popup.locator('.timer-panel').evaluate(panel => {
      const rect = panel.getBoundingClientRect();
      return rect.left === 0 && rect.top === 0 && rect.width === innerWidth && rect.height === innerHeight
        && document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight;
    }), 'The timer fills the entire window without scrolling');
  };
  await fillsTimerWindow();
  await checkTimerHitTargets(popup);
  assert.deepEqual(await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().includes('timer=popout'));
    return { bounds: window.getBounds(), content: window.getContentBounds(), title: window.getTitle() };
  }).then(({ bounds, content, title }) => ({ frameless: JSON.stringify(bounds) === JSON.stringify(content), title })), { frameless: true, title: 'antwork timer' });
  for (const size of [[1100, 720], [280, 200], [360, 400], [640, 400]]) {
    await app.evaluate(({ BrowserWindow }, [width, height]) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().includes('timer=popout')).setSize(width, height), size);
    await until(() => popup.evaluate(([width, height]) => innerWidth === width && innerHeight === height, size), 'resized timer viewport');
    await fillsTimerWindow();
    await checkTimerHitTargets(popup);
  }
  assert.deepEqual(await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().includes('timer=popout'));
    return { resizable: window.isResizable(), movable: window.isMovable() };
  }), { resizable: true, movable: true });
  await popup.getByRole('button', { name: 'Maximize timer window', exact: true }).click();
  await until(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().includes('timer=popout')).isMaximized()), 'maximized timer window');
  await popup.getByRole('button', { name: 'Restore timer window', exact: true }).click();
  await until(() => popup.evaluate(() => innerWidth === 640 && innerHeight === 400), 'restored timer size');
  await popup.getByRole('button', { name: 'Maximize timer window', exact: true }).waitFor();
  await popup.getByRole('button', { name: 'Minimize timer window', exact: true }).click();
  await until(async () => !(await popup.evaluate(() => window.antworkDesktop.isWindowVisible())), 'minimized timer window');
  assert.notEqual((await readData()).timer.runningSince, null, 'Minimizing the timer keeps recording');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(window => window.webContents.getURL().includes('timer=popout')).restore());
  await until(() => popup.evaluate(() => window.antworkDesktop.isWindowVisible()), 'restored timer window');
  const glass = await popup.locator('.timer-controls .primary').evaluate(el => {
    const style = getComputedStyle(el);
    const paint = document.createElement('canvas').getContext('2d');
    paint.fillStyle = style.backgroundColor; paint.fillRect(0, 0, 1, 1);
    return { alpha: paint.getImageData(0, 0, 1, 1).data[3], blur: style.backdropFilter };
  });
  assert.ok(glass.alpha > 0 && glass.alpha < 255 && glass.blur !== 'none', 'Timer buttons have a translucent glass surface');
  assert.equal(await popup.evaluate(() => typeof window.require), 'undefined');
  assert.ok(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: 'Pop out timer' }).click();
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 2, 'Reuse the existing timer window');
  await popup.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Resume', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await popup.getByRole('button', { name: 'Pause', exact: true }).waitFor();
  const withBackground = await readData();
  const background = await popup.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 600;
    const paint = canvas.getContext('2d');
    const gradient = paint.createLinearGradient(0, 0, 960, 600);
    gradient.addColorStop(0, '#48686d'); gradient.addColorStop(.5, '#332d40'); gradient.addColorStop(1, '#ab6047');
    paint.fillStyle = gradient; paint.fillRect(0, 0, 960, 600);
    paint.strokeStyle = 'rgba(233,220,183,.6)'; paint.lineWidth = 12;
    for (let x = -300; x < 1200; x += 130) { paint.beginPath(); paint.moveTo(x, 0); paint.lineTo(x + 350, 600); paint.stroke(); }
    return canvas.toDataURL('image/webp', .85);
  });
  await putData({ ...withBackground, timerPanel: { ...withBackground.timerPanel, image: background } });
  await popup.locator('.timer-panel-image').waitFor();
  await popup.screenshot({ path: path.join(directory, 'timer-popout.png') });
  const beforeSleep = (await readData()).timer;
  const sleepAt = await app.evaluate(({ powerMonitor }) => { const at = Date.now(); powerMonitor.emit('suspend'); return at; });
  const asleep = await timerMatches(timer => timer?.runningSince === null);
  assert.ok(Math.abs(asleep.timer.accumulatedMs - (beforeSleep.accumulatedMs + sleepAt - beforeSleep.runningSince)) < 1000, 'Pause stops at the sleep event');
  await new Promise(resolve => setTimeout(resolve, 1500));
  await app.evaluate(({ powerMonitor }) => powerMonitor.emit('resume'));
  assert.deepEqual((await readData()).timer, asleep.timer, 'Resume from sleep requires a manual timer resume');
  await popup.getByRole('button', { name: 'Resume', exact: true }).waitFor();
  await popup.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).waitFor();
  const popupClosed = popup.waitForEvent('close');
  await popup.getByRole('button', { name: 'Close timer window' }).click();
  await popupClosed;
  assert.notEqual((await readData()).timer.runningSince, null, 'Closing the pop-out leaves the main timer running');
  await timerMatches(timer => timer?.runningSince != null);
  const reopenedPopupPromise = app.waitForEvent('window');
  await page.getByRole('button', { name: 'Pop out timer' }).click();
  const reopenedPopup = await reopenedPopupPromise;
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find(window => window.webContents.getURL().includes('timer=popout'));
    window.setPosition(40, 40); window.showInactive();
  });
  await reopenedPopup.getByRole('button', { name: 'Finish session' }).click();
  await page.getByRole('dialog', { name: 'Session complete', exact: true }).waitFor();
  const review = reopenedPopup.getByRole('dialog', { name: 'Session complete', exact: true });
  await review.getByLabel('Session note').fill('Offline desktop session');
  await review.getByRole('button', { name: 'Save session' }).click();
  await review.waitFor({ state: 'hidden' });
  await page.getByRole('dialog', { name: 'Session complete', exact: true }).waitFor({ state: 'hidden' });
  assert.equal((await readData()).sessions.length, 1, 'Both timer windows save only one session');
  assert.equal((await readData()).sessions[0].note, 'Offline desktop session');
  await reopenedPopup.getByRole('combobox', { name: 'Mode', exact: true }).selectOption('countdown');
  await reopenedPopup.getByRole('spinbutton', { name: 'Minutes', exact: true }).waitFor();
  await checkTimerHitTargets(reopenedPopup);
  assert.ok(await reopenedPopup.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth), 'Countdown setup fits the frameless window');

  await nav('Profile');
  await page.getByRole('heading', { name: 'Career overview' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Edit profile' }).count(), 0);
  const backup = await readData();
  await page.getByRole('button', { name: 'Export JSON' }).click();
  const exported = await until(async () => {
    for (const name of await readdir(downloads)) {
      if (!name.endsWith('.json')) continue;
      try { return JSON.parse(await readFile(path.join(downloads, name), 'utf8')); } catch { /* Download is still being written. */ }
    }
  }, 'exported JSON backup');
  assert.deepEqual(exported, backup, 'Native export writes the full local history');
  const imported = { ...backup, profile: { ...backup.profile, bio: 'Imported from the web backup workflow' } };
  await page.locator('input[type=file]').setInputFiles({ name: 'transfer.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  const confirmation = page.getByRole('dialog', { name: 'Replace local history', exact: true });
  await confirmation.getByRole('button', { name: 'Replace local history', exact: true }).click();
  await confirmation.waitFor({ state: 'hidden' });
  assert.deepEqual(await readData(), imported, 'Import preserves the existing JSON workflow');
  console.log('Sleep pause, manual resume, session save, and JSON transfer passed.');

  await nav('Dashboard');
  await page.getByRole('button', { name: 'Start lock-in' }).click();
  const beforeClose = await timerMatches(timer => timer?.runningSince != null);
  await new Promise(resolve => setTimeout(resolve, 500));
  await closeNormally();
  await new Promise(resolve => setTimeout(resolve, 1200));
  await launch();
  const reopened = await readData();
  assert.equal(reopened.timer.id, beforeClose.timer.id);
  assert.equal(reopened.timer.runningSince, null, 'Closing and reopening leaves the timer paused');
  assert.deepEqual(reopened.sessions, imported.sessions, 'Reopening retains saved history');
  assert.deepEqual(reopened.profile, imported.profile);
  await nav('Timers');
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await timerMatches(timer => timer?.runningSince != null);
  await until(async () => {
    const checkpoint = JSON.parse(await readFile(path.join(profile, 'timer-checkpoint.json'), 'utf8'));
    return !checkpoint.pausedAt && checkpoint;
  }, 'running timer checkpoint');
  const checkpoint = JSON.parse(await readFile(path.join(profile, 'timer-checkpoint.json'), 'utf8'));
  const crashed = app.waitForEvent('close');
  // Exit immediately, bypassing window-close persistence and any Windows launcher wrapper.
  await app.evaluate(({ app }) => { setImmediate(() => app.exit(97)); });
  await crashed;
  app = null;
  await new Promise(resolve => setTimeout(resolve, 1200));
  await launch();
  const recovered = await readData();
  assert.equal(recovered.timer.runningSince, null, 'Crash recovery pauses the timer');
  assert.ok(recovered.timer.intervals.at(-1).end <= checkpoint.lastSeenAt + 1000, 'Crash recovery excludes time after the last durable heartbeat');
  assert.deepEqual(recovered.sessions, imported.sessions);

  const trayCountdownStart = Date.now();
  const trayCountdownDuration = 2000.5; // Backups may contain fractional milliseconds.
  await putData({ ...recovered, timer: { id: randomUUID(), mode: 'countdown', durationMs: trayCountdownDuration, accumulatedMs: 0, intervals: [], runningSince: trayCountdownStart, questOccurrenceId: null, campaignId: null } });
  await timerMatches(timer => timer?.runningSince === trayCountdownStart);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize());
  await until(async () => !(await page.evaluate(() => window.antworkDesktop.isWindowVisible())), 'hidden window');
  const afterTrayCountdown = await timerMatches((timer, data) => timer === null && data.sessions.length === recovered.sessions.length + 1);
  assert.ok(Date.now() - trayCountdownStart < 4500, 'A native deadline finishes the countdown promptly while in the tray');
  assert.equal(afterTrayCountdown.sessions.at(-1).intervals.reduce((sum, interval) => sum + interval.end - interval.start, 0), trayCountdownDuration);
  await new Promise(resolve => setTimeout(resolve, 1200));
  assert.equal((await readData()).sessions.length, afterTrayCountdown.sessions.length, 'Tray completion saves exactly one session');
  await app.evaluate(({ app }) => app.emit('activate'));
  await until(() => page.evaluate(() => window.antworkDesktop.isWindowVisible()), 'visible window');

  const countdownStart = Date.now();
  await putData({ ...afterTrayCountdown, pendingReviewId: null, timer: { id: randomUUID(), mode: 'countdown', durationMs: 2000, accumulatedMs: 0, intervals: [], runningSince: countdownStart, questOccurrenceId: null, campaignId: null } });
  await timerMatches(timer => timer?.runningSince === countdownStart);
  await app.evaluate(({ powerMonitor }) => powerMonitor.emit('suspend'));
  const pausedCountdown = await timerMatches(timer => timer?.mode === 'countdown' && timer.runningSince === null);
  await new Promise(resolve => setTimeout(resolve, 2500));
  const afterSleep = await readData();
  assert.deepEqual(afterSleep.timer, pausedCountdown.timer, 'A countdown cannot finish while Windows is asleep');
  assert.equal(afterSleep.sessions.length, afterTrayCountdown.sessions.length);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(620, 780));
  await nav('Timers');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Small desktop window fits');
  await page.screenshot({ path: path.join(directory, 'timer-small.png'), fullPage: true });
  await closeNormally();
  assert.deepEqual(remoteRequests, [], 'Desktop use makes no external network requests');
  assert.deepEqual(errors, [], 'No renderer or CSP errors');
  console.log(`Desktop smoke passed (${executable ? 'packaged executable' : 'development launcher'}). Evidence: ${directory}`);
} finally {
  if (app) await app.close();
}
