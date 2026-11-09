/**
 * FitCal / Bilans - IndexedDB Database Layer + Synchronizacja z backendem
 * Obsługuje profile użytkowników (w tym Michał i Martynka), historię dni i posiłki.
 */

const DB_NAME = 'BilansAppDB';
const DB_VERSION = 1;

export const INITIAL_USERS = [
  {
    id: 'user_michal',
    name: 'Michał',
    gender: 'male',
    ageYears: 20,
    weightKg: 91,
    heightCm: 186,
    activityLevel: 'moderate',
    goal: 'cut_slow',
    targets: {
      bmr: 1978,
      tdee: 3065,
      calories: { target: 2759, min: 2621, max: 2897 },
      protein: { target: 173, min: 156, max: 190 },
      fat: { target: 77, min: 69, max: 89 },
      carbs: { target: 344, min: 310, max: 378 }
    },
    createdAt: '2026-11-08T10:00:00.000Z',
    updatedAt: '2026-11-09T13:57:00.000Z'
  },
  {
    id: 'user_martynka',
    name: 'Martyna',
    gender: 'female',
    ageYears: 21,
    weightKg: 67,
    heightCm: 165,
    activityLevel: 'light',
    goal: 'cut_slow',
    targets: {
      bmr: 1435,
      tdee: 1973,
      calories: { target: 1776, min: 1687, max: 1865 },
      protein: { target: 127, min: 114, max: 140 },
      fat: { target: 54, min: 49, max: 62 },
      carbs: { target: 196, min: 176, max: 216 }
    },
    createdAt: '2026-11-08T10:00:00.000Z',
    updatedAt: '2026-11-09T13:57:00.000Z'
  }
];

export class Database {
  constructor() {
    this.db = null;
    this.hasServer = false;
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

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        try {
          await this.ensureInitialUsers();
          await this.syncWithServer();

          // Jednorazowe wylogowanie wszystkich aktywnych sesji w przeglądarkach
          const resetDone = await this.getSetting('session_logout_reset_v2');
          if (!resetDone) {
            await this.saveSetting('activeUserId', null);
            await this.saveSetting('session_logout_reset_v2', true);
          }
        } catch (e) {
          console.warn('[Bilans DB] Inicjalizacja profili:', e);
        }
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('Błąd otwarcia bazy IndexedDB:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Upewnij się, że Michał i Martyna istnieją w bazie z aktualnymi parametrami
  async ensureInitialUsers() {
    const existing = await this.getAllUsers();

    // 1. Sprawdź profil Michała - jeśli ma inne parametry, zaktualizuj go do 20 lat, 91 kg, 186 cm, umiarkowana aktywność, redukcja -10%
    const michalInDb = existing.find(u => {
      const n = (u.name || '').trim().toLowerCase();
      return n === 'michał' || n === 'michal';
    });

    if (michalInDb && (michalInDb.weightKg !== 91 || michalInDb.ageYears !== 20 || michalInDb.heightCm !== 186 || michalInDb.goal !== 'cut_slow' || michalInDb.targets?.calories?.target !== 2759)) {
      const updatedMichal = {
        ...michalInDb,
        name: 'Michał',
        gender: 'male',
        ageYears: 20,
        weightKg: 91,
        heightCm: 186,
        activityLevel: 'moderate',
        goal: 'cut_slow',
        targets: INITIAL_USERS[0].targets,
        updatedAt: new Date().toISOString()
      };
      await this.saveUserDirect(updatedMichal);
    }

    // 2. Sprawdź profil Martyny - zaktualizuj do 21 lat, 67 kg, 165 cm, niska aktywność, łagodna redukcja -10%
    const martynaInDb = existing.find(u => {
      const n = (u.name || '').trim().toLowerCase();
      return n === 'martyna' || n === 'martynka';
    });

    if (martynaInDb && (martynaInDb.weightKg !== 67 || martynaInDb.ageYears !== 21 || martynaInDb.heightCm !== 165 || martynaInDb.activityLevel !== 'light' || martynaInDb.goal !== 'cut_slow')) {
      const updatedMartyna = {
        ...martynaInDb,
        name: 'Martyna',
        gender: 'female',
        ageYears: 21,
        weightKg: 67,
        heightCm: 165,
        activityLevel: 'light',
        goal: 'cut_slow',
        targets: INITIAL_USERS[1].targets,
        updatedAt: new Date().toISOString()
      };
      await this.saveUserDirect(updatedMartyna);
    }

    const currentUsers = await this.getAllUsers();
    const existingNames = currentUsers.map(u => (u.name || '').trim().toLowerCase());

    for (const initUser of INITIAL_USERS) {
      const normName = initUser.name.toLowerCase();
      const hasMatch = existingNames.some(name => 
        name === normName ||
        (normName === 'michał' && name === 'michal') ||
        (normName === 'martyna' && name === 'martynka')
      );
      if (!hasMatch) {
        await this.saveUserDirect(initUser);
      }
    }
  }

  // Zapis użytkownika do IndexedDB bez zmiany aktywnej sesji
  async saveUserDirect(userData) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['users'], 'readwrite');
      const userStore = tx.objectStore('users');
      userStore.put(userData);
      tx.oncomplete = () => resolve(userData);
      tx.onerror = () => reject(tx.error);
    });
  }

  // Synchronizacja z serwerem (jeśli jest dostępny)
  async syncWithServer() {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        this.hasServer = true;
        const serverUsers = await res.json();
        if (Array.isArray(serverUsers)) {
          for (const u of serverUsers) {
            await this.saveUserDirect(u);
          }
        }
      }
    } catch {
      this.hasServer = false;
    }
  }

  // Zapisz użytkownika i ustaw jako aktywnego
  async saveUser(user, makeActive = true) {
    await this.init();

    // Generuj czytelny id jeśli brak
    const normName = (user.name || 'uzytkownik').trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    const userId = user.id || `user_${normName}`;

    const userData = {
      ...user,
      id: userId,
      updatedAt: new Date().toISOString(),
      createdAt: user.createdAt || new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
      const stores = makeActive ? ['users', 'settings'] : ['users'];
      const tx = this.db.transaction(stores, 'readwrite');
      const userStore = tx.objectStore('users');
      userStore.put(userData);

      if (makeActive) {
        const settingsStore = tx.objectStore('settings');
        settingsStore.put({ key: 'activeUserId', value: userData.id });
      }

      tx.oncomplete = async () => {
        // Asynchroniczna synchronizacja z backendem
        try {
          fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
          }).catch(() => {});
        } catch {}
        resolve(userData);
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  // Ustawienie aktywnego użytkownika (logowanie)
  async setActiveUser(userId) {
    await this.init();
    return this.saveSetting('activeUserId', userId);
  }

  // Wylogowanie (wyczyszczenie aktywnej sesji, aby pokazać wybór kont)
  async logout() {
    await this.init();
    return this.saveSetting('activeUserId', null);
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
        const activeId = settingReq.result?.value;
        if (!activeId) {
          resolve(null);
          return;
        }

        const userReq = userStore.get(activeId);
        userReq.onsuccess = () => {
          resolve(userReq.result || null);
        };
        userReq.onerror = () => reject(userReq.error);
      };
      settingReq.onerror = () => reject(settingReq.error);
    });
  }

  // Wyszukaj użytkownika po imieniu (case-insensitive + obsługa zdrobnień/wariantów)
  async getUserByName(name) {
    if (!name) return null;
    const users = await this.getAllUsers();
    const query = name.trim().toLowerCase();
    return users.find(u => {
      const uName = (u.name || '').trim().toLowerCase();
      if (uName === query) return true;
      if ((query === 'michal' || query === 'michał') && (uName === 'michał' || uName === 'michal')) return true;
      if ((query === 'martyna' || query === 'martynka') && (uName === 'martyna' || uName === 'martynka')) return true;
      return false;
    }) || null;
  }

  // Pobierz wszystkich użytkowników z bazy
  async getAllUsers() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['users'], 'readonly');
      const userStore = tx.objectStore('users');
      const req = userStore.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // Zapisz posiłek
  async saveMealItem(mealData) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['meals'], 'readwrite');
      const mealStore = tx.objectStore('meals');
      const record = {
        ...mealData,
        createdAt: mealData.createdAt || new Date().toISOString()
      };
      const req = mealStore.add(record);
      req.onsuccess = () => {
        const generatedId = req.result;
        record.id = generatedId;

        // Synchronizuj w tle z serwerem
        try {
          fetch('/api/meals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
          }).catch(() => {});
        } catch {}

        resolve(generatedId);
      };
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
        let results = request.result || [];
        // Jeśli użytkownik nie ma jeszcze posiłków pod nowym ID, sprawdź czy były pod default_user
        if (results.length === 0 && userId.includes('michal')) {
          const fallbackReq = index.getAll(IDBKeyRange.only(['default_user', dateStr]));
          fallbackReq.onsuccess = () => {
            resolve(fallbackReq.result || []);
          };
          fallbackReq.onerror = () => resolve([]);
          return;
        }
        resolve(results);
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
      req.onsuccess = () => {
        try {
          fetch(`/api/meals?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
        } catch {}
        resolve(true);
      };
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

  // Zapisz dowolne ustawienie
  async saveSetting(key, value) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['settings'], 'readwrite');
      const store = tx.objectStore('settings');
      const req = store.put({ key, value });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // Pobierz ustawienie
  async getSetting(key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['settings'], 'readonly');
      const store = tx.objectStore('settings');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }
}

export const db = new Database();
