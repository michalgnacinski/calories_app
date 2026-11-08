/**
 * FitCal / Bilans - IndexedDB Database Layer
 * Obsługuje przechowywanie profilu użytkownika, historii dni i posiłków.
 */

const DB_NAME = 'BilansAppDB';
const DB_VERSION = 1;

export class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Tabela użytkowników
        if (!db.objectStoreNames.contains('users')) {
          const userStore = db.createObjectStore('users', { keyPath: 'id' });
          userStore.createIndex('name', 'name', { unique: false });
        }

        // Tabela posiłków (z indeksami na datę i użytkownika)
        if (!db.objectStoreNames.contains('meals')) {
          const mealStore = db.createObjectStore('meals', { keyPath: 'id', autoIncrement: true });
          mealStore.createIndex('date', 'date', { unique: false });
          mealStore.createIndex('userId', 'userId', { unique: false });
          mealStore.createIndex('user_date', ['userId', 'date'], { unique: false });
        }

        // Tabela ustawień / sesji aktywnego usera
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('Błąd otwarcia bazy IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Zapisz aktywnego użytkownika
  async saveUser(user) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['users', 'settings'], 'readwrite');
      const userStore = tx.objectStore('users');
      const settingsStore = tx.objectStore('settings');

      const userData = {
        ...user,
        id: user.id || 'default_user',
        updatedAt: new Date().toISOString()
      };

      userStore.put(userData);
      settingsStore.put({ key: 'activeUserId', value: userData.id });

      tx.oncomplete = () => resolve(userData);
      tx.onerror = () => reject(tx.error);
    });
  }

  // Pobierz aktywnego użytkownika
  async getActiveUser() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['users', 'settings'], 'readonly');
      const settingsStore = tx.objectStore('settings');
      const userStore = tx.objectStore('users');

      const settingReq = settingsStore.get('activeUserId');
      settingReq.onsuccess = () => {
        const activeId = settingReq.result?.value || 'default_user';
        const userReq = userStore.get(activeId);
        userReq.onsuccess = () => resolve(userReq.result || null);
        userReq.onerror = () => reject(userReq.error);
      };
      settingReq.onerror = () => reject(settingReq.error);
    });
  }

  // Zapisz pojedynczy posiłek dla danego dnia
  async saveMealItem(mealData) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['meals'], 'readwrite');
      const mealStore = tx.objectStore('meals');
      const req = mealStore.add({
        ...mealData,
        createdAt: new Date().toISOString()
      });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // Pobierz wszystkie posiłki dla danego dnia i użytkownika
  async getMealsByDate(userId, dateStr) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['meals'], 'readonly');
      const mealStore = tx.objectStore('meals');
      const index = mealStore.index('user_date');
      const request = index.getAll(IDBKeyRange.only([userId, dateStr]));

      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Usuń posiłek po ID
  async deleteMeal(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['meals'], 'readwrite');
      const mealStore = tx.objectStore('meals');
      const req = mealStore.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // Wyczyść posiłki z danego dnia
  async clearDayMeals(userId, dateStr) {
    await this.init();
    const meals = await this.getMealsByDate(userId, dateStr);
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['meals'], 'readwrite');
      const mealStore = tx.objectStore('meals');
      meals.forEach(m => mealStore.delete(m.id));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const db = new Database();

