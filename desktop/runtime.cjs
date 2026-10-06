const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function assetPath(root, address) {
  const url = new URL(address);
  if (url.protocol !== 'antwork:' || url.host !== 'app' || url.username || url.password) throw new Error('Invalid app origin');
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.includes('\\') || pathname.includes('\0')) throw new Error('Invalid asset path');
  const file = path.resolve(root, '.' + pathname);
  const relative = path.relative(root, file);
  if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) throw new Error('Asset outside app');
  return file;
}

class DesktopLifecycle {
  constructor(file) {
    this.file = file;
    this.heartbeat = null;
    this.lastSeenAt = null;
    this.pending = { id: randomUUID(), at: 0, reason: 'recovery' };
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      const at = saved.pausedAt ?? saved.lastSeenAt;
      if (Number.isFinite(at) && at > 0) {
        this.lastSeenAt = at;
        this.pending = { id: randomUUID(), at: Math.min(at, Date.now()), reason: 'recovery' };
      }
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn('Could not read the timer recovery checkpoint.');
    }
  }

  save(at, pausedAt = null) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = this.file + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify({ lastSeenAt: at, pausedAt }));
    fs.renameSync(temporary, this.file);
    this.lastSeenAt = at;
  }

  reportTimer(runningSince) {
    this.stopHeartbeat();
    if (!Number.isFinite(runningSince) || runningSince <= 0) return;
    if (this.pending && runningSince <= this.pending.at) return;
    this.pending = null;
    this.save(Date.now());
    this.heartbeat = setInterval(() => {
      try { this.save(Date.now()); }
      catch { this.stopHeartbeat(); console.error('Could not save the timer recovery checkpoint.'); }
    }, 5000);
    this.heartbeat.unref();
  }

  pause(reason, at = Date.now()) {
    this.stopHeartbeat();
    this.pending = { id: randomUUID(), at, reason };
    this.save(at, at);
    return this.pending;
  }

  acknowledge(id) {
    if (this.pending?.id !== id) return false;
    this.pending = null;
    return true;
  }

  stopHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }
}

module.exports = { assetPath, DesktopLifecycle };
