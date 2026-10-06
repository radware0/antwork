import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { _electron } from 'playwright-core';

assert.equal(process.platform, 'win32', 'Installer QA requires Windows');
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const installer = path.resolve(`out/make/squirrel.windows/x64/antwork-${version}-Setup.exe`);
const localRoot = path.resolve(process.env.LOCALAPPDATA);
const installRoot = path.resolve(localRoot, 'antwork');
assert.equal(path.dirname(installRoot), localRoot);
const installedExe = path.join(installRoot, `app-${version}`, 'antwork.exe');
const updater = path.join(installRoot, 'Update.exe');
const exists = file => access(file).then(() => true, () => false);
assert.equal(await exists(installRoot), false, 'Use a machine without an existing antwork install; QA never removes a pre-existing installation');
const nonce = randomUUID();
const evidence = path.resolve('.qa', `installer-${nonce}`);
const profile = path.join(evidence, 'profile');
const defaultProfile = path.resolve(process.env.APPDATA, 'antwork');
const defaultProfileExisted = await exists(defaultProfile);
const marker = path.join(defaultProfile, `installer-qa-${nonce}.marker`);
const env = { ...process.env, ANTWORK_TEST_USER_DATA_DIR: profile };
delete env.ELECTRON_RUN_AS_NODE;
await mkdir(evidence, { recursive: true });
let installed = false;
let app;

const run = (file, args, childEnv = env) => new Promise((resolve, reject) => {
  const child = spawn(file, args, { env: childEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  child.on('error', reject);
  child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(`${path.basename(file)} exited ${code}: ${output}`)));
});
const powershell = command => run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command]);
const isAdmin = await powershell('[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)');
assert.equal(isAdmin, 'False', 'Run installer QA without elevation');
await mkdir(defaultProfile, { recursive: true });
await writeFile(marker, nonce, { flag: 'wx' });
const readData = page => page.evaluate(() => new Promise(resolve => {
  const request = indexedDB.open('work-ledger', 1);
  request.onsuccess = () => { const db = request.result; const get = db.transaction('documents').objectStore('documents').get('current'); get.onsuccess = () => { resolve(get.result); db.close(); }; };
}));
async function launch() {
  app = await _electron.launch({ executablePath: installedExe, args: ['--no-error-dialogs'], env });
  const page = await app.firstWindow();
  await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
  return page;
}
async function close() {
  const closed = app.waitForEvent('close');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await closed; app = null;
}
async function install() {
  await run(installer, ['--silent']);
  installed = true;
  assert.ok(await exists(installedExe), 'Per-user executable exists');
}
async function uninstall() {
  // The target was absent before this test and its resolved parent is LOCALAPPDATA.
  await run(updater, ['--uninstall', '--silent']);
  installed = false;
  assert.equal(await exists(installedExe), false, 'Uninstall removes application files');
  assert.equal(await readFile(marker, 'utf8'), nonce, 'Uninstall preserves the default user-data directory');
}

try {
  await install();
  console.log('Installer ran without elevation.');
  const registration = JSON.parse(await powershell("Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\antwork' | Select-Object DisplayName,DisplayVersion,InstallLocation | ConvertTo-Json -Compress"));
  assert.equal(registration.DisplayName, 'antwork');
  assert.equal(registration.DisplayVersion, version);
  let page = await launch();
  await page.getByRole('dialog', { name: 'Pick your handle' }).waitFor({ state: 'hidden' });
  const before = await readData(page);
  const backup = { ...before, profile: { ...before.profile, bio: nonce }, journals: [{ date: before.setupDate, text: 'Installer retention check', updatedAt: Date.now() }], sessions: [{ id: randomUUID(), timing: 'duration', date: before.setupDate, durationMinutes: 10, intervals: [], source: 'manual', questOccurrenceId: null, campaignId: null, note: 'Preserve this test history', result: null }] };
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Profile', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'retention.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole('dialog', { name: 'Replace local history' }).getByRole('button', { name: 'Replace local history', exact: true }).click();
  await page.getByRole('dialog', { name: 'Replace local history' }).waitFor({ state: 'hidden' });
  const saved = await readData(page);
  assert.equal(saved.sessions[0].note, 'Preserve this test history');
  await close();
  await uninstall();
  await install();
  page = await launch();
  assert.deepEqual(await readData(page), saved, 'Reinstall retains actual IndexedDB history');
  await close();
  await uninstall();
  await writeFile(path.join(evidence, 'result.json'), JSON.stringify({ version, elevated: false, installRoot, registration, uninstallPreservedDefaultProfile: true, reinstallPreservedHistory: true, profile }, null, 2));
  console.log(`Standard-user install, uninstall, and reinstall passed. Evidence: ${evidence}`);
} finally {
  if (app) await app.close();
  if (installed && await exists(updater)) await run(updater, ['--uninstall', '--silent']);
  if (await exists(marker) && await readFile(marker, 'utf8') === nonce) await unlink(marker);
  if (!defaultProfileExisted) await rmdir(defaultProfile).catch(error => { if (error.code !== 'ENOTEMPTY') throw error; });
}
