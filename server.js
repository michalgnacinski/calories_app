/**
 * Bilans - Lekki serwer aplikacji z obsługą .env i bezpiecznego endpointu Vision AI
 * Czysty Node.js bez zewnętrznych zależności.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Prosty wbudowany parser .env
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        process.env[key] = value;
      }
    }
    console.log('[Bilans Server] Załadowano konfigurację z pliku .env');
  }
}

loadEnv();

const PORT = parseInt(process.env.PORT || '3000', 10);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MEALS_FILE = path.join(DATA_DIR, 'meals.json');

// Upewnij się, że katalog data istnieje i zainicjalizuj domyślnych użytkowników
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_USERS = [
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

function readUsersFromFile() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const content = fs.readFileSync(USERS_FILE, 'utf8');
      const users = JSON.parse(content || '[]');
      if (Array.isArray(users) && users.length > 0) return users;
    }
  } catch (e) {
    console.error('[Bilans Server] Błąd odczytu users.json:', e.message);
  }
  fs.writeFileSync(USERS_FILE, JSON.stringify(DEFAULT_USERS, null, 2), 'utf8');
  return DEFAULT_USERS;
}

function writeUsersToFile(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) {
    console.error('[Bilans Server] Błąd zapisu users.json:', e.message);
  }
}

function readMealsFromFile() {
  try {
    if (fs.existsSync(MEALS_FILE)) {
      const content = fs.readFileSync(MEALS_FILE, 'utf8');
      const meals = JSON.parse(content || '[]');
      if (Array.isArray(meals)) return meals;
    }
  } catch (e) {
    console.error('[Bilans Server] Błąd odczytu meals.json:', e.message);
  }
  return [];
}

function writeMealsToFile(meals) {
  try {
    fs.writeFileSync(MEALS_FILE, JSON.stringify(meals, null, 2), 'utf8');
  } catch (e) {
    console.error('[Bilans Server] Błąd zapisu meals.json:', e.message);
  }
}

// Inicjalizacja przy starcie
readUsersFromFile();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const VISION_PROMPT = `Jesteś ekspertem dietetyki i analizy żywności.
Przeanalizuj przesłane zdjęcie potrawy / talerza z jedzeniem.
Twoje zadanie:
1. Zidentyfikuj ogólną nazwę dania (w języku polskim, np. "Jajecznica z pomidorkami i chlebem", "Sałatka z kurczakiem", "Pancakes z sosem truskawkowym").
2. Rozbij posiłek na poszczególne widoczne składniki z realistycznym oszacowaniem ich wielkości porcji / wagi w gramach.
3. Dla każdego składnika oszacuj:
   - weightG: waga w gramach (liczba całkowita)
   - kcal: kalorie (liczba całkowita)
   - protein: białko w gramach (zaokrąglone do 0.1)
   - fat: tłuszcz w gramach (zaokrąglone do 0.1)
   - carbs: węglowodany w gramach (zaokrąglone do 0.1)
   - unitDesc: opis porcji, np. "3 jaja (165g)", "1 kromka (35g)", "garść (30g)"

Zwróć odpowiedź WYŁĄCZNIE w formacie JSON zgodnym z poniższym schematem:
{
  "dishTitle": "Nazwa dania po polsku",
  "items": [
    {
      "name": "Nazwa składnika",
      "weightG": 150,
      "unitDesc": "1 porcja (150g)",
      "kcal": 210,
      "protein": 18.5,
      "fat": 12.0,
      "carbs": 5.0
    }
  ],
  "totalKcal": 210
}`;

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS dla lokalnych testów
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host}`);

  // Endpoint 1: Informacja o konfiguracji środowiska
  if (reqUrl.pathname === '/api/config' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim())
    }));
    return;
  }

  // Endpoint 2: Pobranie wszystkich użytkowników
  if (reqUrl.pathname === '/api/users' && req.method === 'GET') {
    const users = readUsersFromFile();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(users));
    return;
  }

  // Endpoint 3: Zapisanie / aktualizacja użytkownika
  if (reqUrl.pathname === '/api/users' && req.method === 'POST') {
    try {
      const userData = await parseJsonBody(req);
      if (!userData || !userData.name) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Imię użytkownika jest wymagane.' }));
        return;
      }

      const users = readUsersFromFile();
      const normName = userData.name.trim().toLowerCase();
      const existingIdx = users.findIndex(u => 
        (userData.id && u.id === userData.id) ||
        (u.name && u.name.trim().toLowerCase() === normName)
      );

      const now = new Date().toISOString();
      const cleanId = userData.id || (existingIdx >= 0 ? users[existingIdx].id : `user_${normName.replace(/[^a-z0-9]/g, '_')}_${Date.now()}`);

      const savedUser = {
        ...userData,
        id: cleanId,
        updatedAt: now,
        createdAt: existingIdx >= 0 ? users[existingIdx].createdAt || now : now
      };

      if (existingIdx >= 0) {
        users[existingIdx] = savedUser;
      } else {
        users.push(savedUser);
      }

      writeUsersToFile(users);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(savedUser));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Endpoint 4: Pobranie posiłków
  if (reqUrl.pathname === '/api/meals' && req.method === 'GET') {
    const userId = reqUrl.searchParams.get('userId');
    const date = reqUrl.searchParams.get('date');
    let meals = readMealsFromFile();

    if (userId) {
      meals = meals.filter(m => m.userId === userId || m.userId === 'default_user');
    }
    if (date) {
      meals = meals.filter(m => m.date === date);
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(meals));
    return;
  }

  // Endpoint 5: Dodanie posiłku
  if (reqUrl.pathname === '/api/meals' && req.method === 'POST') {
    try {
      const mealData = await parseJsonBody(req);
      const meals = readMealsFromFile();
      const newMeal = {
        ...mealData,
        id: mealData.id || Date.now(),
        createdAt: mealData.createdAt || new Date().toISOString()
      };
      meals.push(newMeal);
      writeMealsToFile(meals);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(newMeal));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Endpoint 6: Usunięcie posiłku
  if (reqUrl.pathname === '/api/meals' && req.method === 'DELETE') {
    try {
      const idParam = reqUrl.searchParams.get('id');
      const mealId = parseInt(idParam, 10) || idParam;
      let meals = readMealsFromFile();
      meals = meals.filter(m => m.id != mealId);
      writeMealsToFile(meals);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Endpoint 2: Bezpieczna analiza zdjęcia z kluczem z .env
  if (reqUrl.pathname === '/api/analyze-image' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const apiKey = process.env.GEMINI_API_KEY || '';
        if (!apiKey) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Brak klucza GEMINI_API_KEY w pliku .env serwera.' }));
          return;
        }

        const parsedBody = JSON.parse(body || '{}');
        const { imageBase64, mimeType = 'image/jpeg' } = parsedBody;

        if (!imageBase64) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Brak danych zdjęcia (imageBase64).' }));
          return;
        }

        const geminiPayload = {
          contents: [
            {
              parts: [
                { text: VISION_PROMPT },
                {
                  inlineData: {
                    mimeType,
                    data: imageBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        };

        const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

        let geminiRes = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload)
        });

        if (!geminiRes.ok && geminiRes.status === 404) {
          geminiRes = await fetch(fallbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
          });
        }

        if (!geminiRes.ok) {
          const errData = await geminiRes.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `Błąd Gemini API status: ${geminiRes.status}`;
          res.writeHead(geminiRes.status, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: errMsg }));
          return;
        }

        const data = await geminiRes.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Pusta odpowiedź z modelu Gemini.' }));
          return;
        }

        const parsedResult = JSON.parse(rawText);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(parsedResult));
      } catch (err) {
        console.error('[Bilans Server] Błąd analizy zdjęcia:', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Obsługa plików statycznych (PWA)
  let filePath = path.join(__dirname, reqUrl.pathname === '/' ? 'index.html' : reqUrl.pathname);

  // Zabezpieczenie przed wyjściem poza katalog
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA Fallback do index.html
      filePath = path.join(__dirname, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        res.end('Error loading file');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

function startServer(portToTry) {
  server.removeAllListeners('listening');
  server.removeAllListeners('error');

  server.once('listening', () => {
    console.log(`\n======================================================`);
    console.log(`  🍃 Bilans PWA działa pod adresem: http://localhost:${portToTry}`);
    console.log(`  🔑 Klucz Gemini API z pliku .env: ${GEMINI_API_KEY ? 'AKTYWNY ✓' : 'BRAK'}`);
    console.log(`======================================================\n`);
  });

  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Bilans Server] Port ${portToTry} jest zajęty, próbuję ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error('[Bilans Server] Błąd serwera:', err);
    }
  });

  server.listen(portToTry);
}

startServer(PORT);

