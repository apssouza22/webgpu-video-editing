import {
  IDB_DATABASE_NAME,
  IDB_MEDIA_ASSETS_STORE,
  IDB_PROJECTS_STORE,
  type IndexedDbMediaAssetRecord,
  type IndexedDbProjectRecord,
} from './types';

const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DATABASE_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_PROJECTS_STORE)) {
        db.createObjectStore(IDB_PROJECTS_STORE, { keyPath: 'projectId' });
      }
      if (!db.objectStoreNames.contains(IDB_MEDIA_ASSETS_STORE)) {
        const store = db.createObjectStore(IDB_MEDIA_ASSETS_STORE, { keyPath: 'assetId' });
        store.createIndex('projectId', 'projectId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  storeNames: string[],
  run: (stores: Record<string, IDBObjectStore>) => Promise<T> | T,
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeNames, mode);
        const stores = Object.fromEntries(
          storeNames.map((name) => [name, transaction.objectStore(name)]),
        );
        let resultValue: T | undefined;
        let transactionDone = false;

        const tryResolve = (): void => {
          if (resultValue !== undefined && transactionDone) {
            db.close();
            resolve(resultValue);
          }
        };

        transaction.oncomplete = () => {
          transactionDone = true;
          tryResolve();
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
        };

        Promise.resolve(run(stores))
          .then((result) => {
            resultValue = result;
            tryResolve();
          })
          .catch((error) => {
            transaction.abort();
            db.close();
            reject(error instanceof Error ? error : new Error(String(error)));
          });
      }),
  );
}

export class IndexedDbProjectIndex {
  async upsertProject(record: IndexedDbProjectRecord): Promise<void> {
    await runTransaction('readwrite', [IDB_PROJECTS_STORE], (stores) => {
      stores[IDB_PROJECTS_STORE].put(record);
    });
  }

  async getProject(projectId: string): Promise<IndexedDbProjectRecord | null> {
    return runTransaction('readonly', [IDB_PROJECTS_STORE], (stores) => {
      return new Promise<IndexedDbProjectRecord | null>((resolve, reject) => {
        const request = stores[IDB_PROJECTS_STORE].get(projectId);
        request.onsuccess = () => resolve((request.result as IndexedDbProjectRecord) ?? null);
        request.onerror = () => reject(request.error ?? new Error('Failed to read project record.'));
      });
    });
  }

  async listProjects(): Promise<IndexedDbProjectRecord[]> {
    return runTransaction('readonly', [IDB_PROJECTS_STORE], (stores) => {
      return new Promise<IndexedDbProjectRecord[]>((resolve, reject) => {
        const request = stores[IDB_PROJECTS_STORE].getAll();
        request.onsuccess = () => resolve((request.result as IndexedDbProjectRecord[]) ?? []);
        request.onerror = () => reject(request.error ?? new Error('Failed to list projects.'));
      });
    });
  }

  async upsertMediaAsset(record: IndexedDbMediaAssetRecord): Promise<void> {
    await runTransaction('readwrite', [IDB_MEDIA_ASSETS_STORE], (stores) => {
      stores[IDB_MEDIA_ASSETS_STORE].put(record);
    });
  }

  async listMediaAssets(projectId: string): Promise<IndexedDbMediaAssetRecord[]> {
    return runTransaction('readonly', [IDB_MEDIA_ASSETS_STORE], (stores) => {
      return new Promise<IndexedDbMediaAssetRecord[]>((resolve, reject) => {
        const index = stores[IDB_MEDIA_ASSETS_STORE].index('projectId');
        const request = index.getAll(projectId);
        request.onsuccess = () => resolve((request.result as IndexedDbMediaAssetRecord[]) ?? []);
        request.onerror = () => reject(request.error ?? new Error('Failed to list media assets.'));
      });
    });
  }

  async deleteMediaAssetsForProject(projectId: string): Promise<void> {
    const assets = await this.listMediaAssets(projectId);
    if (assets.length === 0) {
      return;
    }

    await runTransaction('readwrite', [IDB_MEDIA_ASSETS_STORE], (stores) => {
      const store = stores[IDB_MEDIA_ASSETS_STORE];
      for (const asset of assets) {
        store.delete(asset.assetId);
      }
    });
  }
}
