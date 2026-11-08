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

const server = http.createServer(async (req, res) => {
  // CORS dla lokalnych testów
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  🍃 Bilans PWA działa pod adresem: http://localhost:${PORT}`);
  console.log(`  🔑 Klucz Gemini API z pliku .env: ${GEMINI_API_KEY ? 'AKTYWNY ✓' : 'BRAK'}`);
  console.log(`======================================================\n`);
});

