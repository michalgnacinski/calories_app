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

/**
 * Analizuje zdjęcie potrawy – najpierw pyta endpoint /api/analyze-image (korzystający z klucza w .env),
 * a w przypadku braku backendu odpytuje bezpośrednio z kluczem zapisanym lokalnie.
 */
export async function analyzeFoodImage(imageBase64, mimeType = 'image/jpeg', fallbackClientKey = '') {
  // 1. Spróbuj wysłać do backendu czytającego z .env
  let lastBackendError = null;
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

    // Jeśli serwer zwrócił błąd powiązany z kluczem, modelem lub backendem
    const errData = await res.json().catch(() => ({}));
    const errMsg = errData?.error || `Błąd serwera (status ${res.status})`;
    lastBackendError = new Error(errMsg);

    if (!fallbackClientKey) {
      throw lastBackendError;
    }
  } catch (backendErr) {
    lastBackendError = backendErr;
    if (!fallbackClientKey) {
      throw backendErr;
    }
  }

  // 2. Fallback: jeśli serwer nie obsłużył zapytania, ale podano klucz lokalnie
  if (fallbackClientKey) {
    return analyzeDirectlyWithGemini(fallbackClientKey, imageBase64, mimeType);
  }

  throw lastBackendError || new Error('Nie udało się przeanalizować zdjęcia. Sprawdź czy serwer Node.js jest uruchomiony z plikiem .env.');
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
