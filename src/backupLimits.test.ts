import test from 'node:test';
import assert from 'node:assert/strict';
import * as storage from './storage.ts';

test('backup import rejects an oversized file before reading it', () => {
  const limits = storage as typeof storage & { MAX_BACKUP_IMPORT_BYTES?: number; assertBackupImportSize?: (bytes: number) => void };
  assert.equal(limits.MAX_BACKUP_IMPORT_BYTES, 32 * 1024 * 1024);
  assert.equal(typeof limits.assertBackupImportSize, 'function');
  assert.doesNotThrow(() => limits.assertBackupImportSize!(limits.MAX_BACKUP_IMPORT_BYTES!));
  assert.throws(() => limits.assertBackupImportSize!(limits.MAX_BACKUP_IMPORT_BYTES! + 1), /too large/i);
  assert.throws(() => limits.assertBackupImportSize!(Number.NaN), /invalid/i);
});
