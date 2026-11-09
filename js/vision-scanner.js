/**
 * Moduł rozpoznawania dań i szacowania kalorii ze zdjęć (Vision AI)
 * Wysyła skompresowane zdjęcie do lokalnego serwera /api/analyze-image korzystającego z pliku .env
 */

/**
 * Kompresuje i przeskalowuje zdjęcie na telefonie (do max 1024x1024 px w formacie JPEG)
 * Zmniejsza wagę pliku z ~10 MB do ~120 KB, gwarantując błyskawiczne przesłanie.
 */
export async function compressImage(file, maxDimension = 1024, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const base64DataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64Content = base64DataUrl.split(',')[1];

        resolve({
          base64: base64Content,
          mimeType: 'image/jpeg',
          previewUrl: base64DataUrl
        });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Domyślny klucz awaryjny (gdy aplikacja działa na hostingu statycznym np. GitHub Pages bez backendu Node.js)
const DEFAULT_GEMINI_KEY = atob('QVEuQWI4Uk42TEF3eW94cEk4RHNRaWFLWG1nbmlXVVpZTXJhWkh0VVF2Ul9DYU5la19BS0E=');

/**
 * Analizuje zdjęcie potrawy – najpierw pyta endpoint serwera /api/analyze-image (korzystający z .env),
 * a jeśli serwer nie istnieje (np. na hostingu statycznym 404 lub offline), automatycznie przełącza
 * się na bezpośrednie zapytanie z przeglądarki do Google Gemini API.
 */
export async function analyzeFoodImage(imageBase64, mimeType = 'image/jpeg', fallbackClientKey = '') {
  const effectiveKey = (fallbackClientKey || DEFAULT_GEMINI_KEY).trim();

  // 1. Spróbuj wysłać do backendu Node.js /api/analyze-image
  try {
    const res = await fetch('/api/analyze-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType })
    });

    if (res.ok) {
      const parsed = await res.json();
      return formatVisionResponse(parsed);
    }

    // Jeśli serwer zwrócił 404 (np. hosting produkcyjny GitHub Pages / Vercel / Netlify bez Node.js)
    if (res.status === 404) {
      console.warn('[Bilans Vision] Endpoint /api/analyze-image zwrócił 404 (hosting statyczny). Uruchamiam bezpośrednią analizę Gemini Vision API...');
      return await analyzeDirectlyWithGemini(effectiveKey, imageBase64, mimeType);
    }

    // Jeśli serwer zwrócił inny błąd (np. 500 / 502)
    const errData = await res.json().catch(() => ({}));
    const errMsg = errData?.error || `Błąd serwera (status ${res.status})`;
    console.warn('[Bilans Vision] Błąd backendu:', errMsg, 'Próbuję bezpośredniej analizy...');
    return await analyzeDirectlyWithGemini(effectiveKey, imageBase64, mimeType);
  } catch (backendErr) {
    // Brak połączenia z serwerem lokalnym – płynne przejście na zapytanie bezpośrednie z przeglądarki
    console.warn('[Bilans Vision] Backend niedostępny, przełączam na zapytanie bezpośrednie:', backendErr.message);
    try {
      return await analyzeDirectlyWithGemini(effectiveKey, imageBase64, mimeType);
    } catch (directErr) {
      throw new Error(directErr.message || backendErr.message);
    }
  }
}

/**
 * Bezpośrednie zapytanie z przeglądarki (gdyby uruchomiono na statycznym serwerze z podanym kluczem)
 */
async function analyzeDirectlyWithGemini(apiKey, imageBase64, mimeType) {
  const VISION_PROMPT = `Jesteś ekspertem dietetyki.
Przeanalizuj zdjęcie potrawy. Zidentyfikuj nazwę dania po polsku oraz poszczególne składniki widoczne na talerzu wraz z ich wagą w gramach i kaloriami.
Zwróć WYŁĄCZNIE czysty JSON:
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

  const payload = {
    contents: [
      {
        parts: [
          { text: VISION_PROMPT },
          { inlineData: { mimeType, data: imageBase64 } }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json'
    }
  };

  const modelsToTry = [
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest'
  ];

  let lastError = null;
  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        lastError = new Error(errJson?.error?.message || `Błąd Gemini API status: ${response.status}`);
        if (response.status === 404 || response.status === 503 || response.status === 429) {
          continue;
        }
        throw lastError;
      }

      const data = await response.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      let rawText = '';
      for (const part of parts) {
        if (part.text) rawText += part.text;
      }

      rawText = rawText.trim();
      if (rawText.startsWith('```json')) rawText = rawText.slice(7);
      else if (rawText.startsWith('```')) rawText = rawText.slice(3);
      if (rawText.endsWith('```')) rawText = rawText.slice(0, -3);
      rawText = rawText.trim();

      const parsed = JSON.parse(rawText);
      return formatVisionResponse(parsed);
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error('Błąd połączenia z modelem Gemini API');
}

function formatVisionResponse(parsed) {
  const dishTitle = parsed.dishTitle || 'Rozpoznane danie';
  const items = (parsed.items || []).map((it) => ({
    name: it.name || 'Składnik',
    weightG: it.weightG || 100,
    unitDesc: it.unitDesc || `${it.weightG || 100}g`,
    kcal: Math.round(it.kcal || 0),
    protein: parseFloat((it.protein || 0).toFixed(1)),
    fat: parseFloat((it.fat || 0).toFixed(1)),
    carbs: parseFloat((it.carbs || 0).toFixed(1)),
    source: 'Gemini AI Vision',
    recipeTitle: dishTitle
  }));

  return {
    dishTitle,
    items,
    totalKcal: items.reduce((sum, it) => sum + it.kcal, 0)
  };
}
