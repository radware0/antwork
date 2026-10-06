const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assetPath, DesktopLifecycle } = require('./runtime.cjs');

test('desktop assets stay inside the bundled directory, including paths containing #', () => {
  const root = path.resolve('a # workspace', 'dist');
  assert.equal(assetPath(root, 'antwork://app/assets/main.js'), path.join(root, 'assets', 'main.js'));
  assert.throws(() => assetPath(root, 'antwork://app/%2f..%2fsecret'), /outside app/);
  assert.throws(() => assetPath(root, 'antwork://app/%5c..%5csecret'), /Invalid asset/);
  assert.throws(() => assetPath(root, 'antwork://other/index.html'), /Invalid app origin/);
});

test('sleep checkpoint survives restart and stale timer state cannot restart its heartbeat', t => {
  fs.mkdirSync(path.resolve('.qa'), { recursive: true });
  const directory = fs.mkdtempSync(path.resolve('.qa', 'desktop-checkpoint-'));
  const file = path.join(directory, 'checkpoint.json');
  const lifecycle = new DesktopLifecycle(file);
  t.after(() => lifecycle.stopHeartbeat());
  lifecycle.pause('sleep', 4000);
  lifecycle.reportTimer(1000);
  assert.equal(lifecycle.heartbeat, null);
  assert.equal(lifecycle.pending.at, 4000);
  const restarted = new DesktopLifecycle(file);
  assert.equal(restarted.pending.at, 4000);
  assert.equal(restarted.pending.reason, 'recovery');
  assert.equal(restarted.acknowledge('wrong-id'), false);
  assert.equal(restarted.acknowledge(restarted.pending.id), true);
});
