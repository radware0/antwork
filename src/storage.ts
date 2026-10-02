import { parseBackup } from './validation.ts';
import { createInitialData, dateKey } from './domain.ts';
import type { AppData } from './types.ts';

export interface LedgerRepository {
  load(): Promise<AppData>;
  update(change: (data: AppData) => AppData): Promise<AppData>;
  replace(data: AppData): Promise<AppData>;
}

const DB_NAME = 'work-ledger';
const STORE = 'documents';
const KEY = 'current';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local storage.'));
  });
}

export function validateImport(value: unknown): AppData { return parseBackup(value); }

export const MAX_BACKUP_IMPORT_BYTES = 32 * 1024 * 1024;
export function assertBackupImportSize(bytes: number): void {
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid backup file size.');
  if (bytes > MAX_BACKUP_IMPORT_BYTES) throw new Error('Backup is too large for this beta (32 MiB maximum).');
}

export class IndexedDbLedgerRepository implements LedgerRepository {
  async load(): Promise<AppData> {
    return this.update(data => data);
  }

  async update(change: (data: AppData) => AppData): Promise<AppData> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      let result: AppData;
      const request = store.get(KEY);
      request.onsuccess = () => {
        try {
          const current = validateImport(request.result ?? createInitialData(dateKey()));
          result = validateImport(change(structuredClone(current)));
          store.put(result, KEY);
        } catch (error) {
          tx.abort();
          reject(error);
        }
      };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Could not save local data.')); };
      tx.onabort = () => db.close();
    });
  }

  async replace(data: AppData): Promise<AppData> {
    const imported = validateImport(data);
    return this.update(() => imported);
  }
}

export const repository: LedgerRepository = new IndexedDbLedgerRepository();
