/**
 * DagoDB — Wrapper IndexedDB pour la persistance locale.
 * Version corrigée pour gérer correctement les promesses IDBRequest.
 */
export class DagoDB {
  #dbName;
  #dbVersion;
  #dbPromise;

  constructor(dbName = 'DagoSpeakDB', dbVersion = 1) {
    this.#dbName = dbName;
    this.#dbVersion = dbVersion;
    this.#dbPromise = this.#init();
  }

  #init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.#dbName, this.#dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('reviews')) {
          db.createObjectStore('reviews', { keyPath: 'itemId' });
        }
        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Méthode générique pour exécuter une transaction.
   * Attend correctement la résolution de la requête IndexedDB.
   */
  async #transaction(storeName, mode, callback) {
    const db = await this.#dbPromise;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);

      // callback retourne un IDBRequest (ex: store.getAll())
      const request = callback(store);

      // C'est ICI la correction : on attend le succès pour récupérer request.result
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);

      // Sécurité supplémentaire en cas d'échec de la transaction elle-même
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // --- API Publique ---

  async put(storeName, data) {
    return this.#transaction(storeName, 'readwrite', (store) => store.put(data));
  }

  async get(storeName, key) {
    return this.#transaction(storeName, 'readonly', (store) => store.get(key));
  }

  async getAll(storeName) {
    return this.#transaction(storeName, 'readonly', (store) => store.getAll());
  }

  async delete(storeName, key) {
    return this.#transaction(storeName, 'readwrite', (store) => store.delete(key));
  }
}