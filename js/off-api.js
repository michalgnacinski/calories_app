/**
 * Moduł integracji z OpenFoodFacts API (https://github.com/openfoodfacts)
 * z inteligentną obsługą fleksji języka polskiego i bazą offline.
 */

// Baza wzorcowa podstawowych produktów diety sportowej (wartości na 100g)
export const COMMON_FOODS = {
  jaj: { name: 'Jajka kurze całe', kcal: 143, p: 12.6, f: 9.5, c: 0.7, unitWeight: 55, unitName: 'szt.' },
  masl: { name: 'Masło ekstra 82%', kcal: 748, p: 0.7, f: 82.5, c: 0.7, unitWeight: 15, unitName: 'łyżka' },
  boczk: { name: 'Boczek wędzony / parzony', kcal: 450, p: 13.0, f: 44.0, c: 0.5, unitWeight: 30, unitName: 'plaster' },
  boczek: { name: 'Boczek wędzony / parzony', kcal: 450, p: 13.0, f: 44.0, c: 0.5, unitWeight: 30, unitName: 'plaster' },
  oliw: { name: 'Oliwa z oliwek z pierwszego tłoczenia', kcal: 884, p: 0.0, f: 100.0, c: 0.0, unitWeight: 10, unitName: 'łyżka' },
  olej: { name: 'Olej rzepakowy / roślinny', kcal: 884, p: 0.0, f: 100.0, c: 0.0, unitWeight: 10, unitName: 'łyżka' },
  kurczak: { name: 'Pierś z kurczaka bez skóry', kcal: 120, p: 22.5, f: 2.6, c: 0.0, unitWeight: 180, unitName: 'filet' },
  indyk: { name: 'Pierś z indyka', kcal: 104, p: 24.0, f: 1.0, c: 0.0, unitWeight: 180, unitName: 'filet' },
  ryz: { name: 'Ryż biały / basmati (suchy)', kcal: 350, p: 7.0, f: 0.6, c: 78.0, unitWeight: 100, unitName: 'woreczek' },
  kasz: { name: 'Kasza gryczana / jaglana', kcal: 345, p: 12.0, f: 3.0, c: 68.0, unitWeight: 100, unitName: 'woreczek' },
  makaron: { name: 'Makaron pełnoziarnisty / durum', kcal: 355, p: 13.0, f: 1.5, c: 71.0, unitWeight: 70, unitName: 'porcja' },
  chleb: { name: 'Chleb żytni / razowy', kcal: 230, p: 6.0, f: 1.5, c: 46.0, unitWeight: 35, unitName: 'kromka' },
  bulk: { name: 'Bułka pszenna / grahamka', kcal: 260, p: 8.5, f: 1.5, c: 52.0, unitWeight: 70, unitName: 'szt.' },
  banan: { name: 'Banan świeży', kcal: 89, p: 1.1, f: 0.3, c: 23.0, unitWeight: 120, unitName: 'szt.' },
  jablk: { name: 'Jabłko świeże', kcal: 52, p: 0.3, f: 0.2, c: 14.0, unitWeight: 150, unitName: 'szt.' },
  mlek: { name: 'Mleko 2%', kcal: 50, p: 3.3, f: 2.0, c: 4.8, unitWeight: 250, unitName: 'szklanka' },
  owsian: { name: 'Płatki owsiane górskie', kcal: 366, p: 13.5, f: 7.0, c: 62.0, unitWeight: 50, unitName: 'porcja' },
  twarog: { name: 'Twaróg chudy / półtłusty', kcal: 110, p: 18.0, f: 3.5, c: 3.5, unitWeight: 100, unitName: 'porcja' },
  ser: { name: 'Ser żółty gouda', kcal: 350, p: 25.0, f: 27.0, c: 0.1, unitWeight: 25, unitName: 'plaster' },
  pomidor: { name: 'Pomidor świeży', kcal: 18, p: 0.9, f: 0.2, c: 3.9, unitWeight: 140, unitName: 'szt.' },
  ogork: { name: 'Ogórek świeży / kiszony', kcal: 14, p: 0.7, f: 0.1, c: 2.5, unitWeight: 100, unitName: 'szt.' },
  awokado: { name: 'Awokado Hass', kcal: 160, p: 2.0, f: 15.0, c: 8.5, unitWeight: 140, unitName: 'szt.' },
  orzech: { name: 'Orzechy włoskie / migdały', kcal: 650, p: 15.0, f: 65.0, c: 14.0, unitWeight: 30, unitName: 'garść' },
  skyr: { name: 'Skyr naturalny', kcal: 65, p: 12.0, f: 0.0, c: 4.0, unitWeight: 150, unitName: 'opakowanie' },
  odzywk: { name: 'Odżywka białkowa WPC', kcal: 380, p: 78.0, f: 5.0, c: 6.0, unitWeight: 30, unitName: 'miarka' },
  bialk: { name: 'Odżywka białkowa WPC', kcal: 380, p: 78.0, f: 5.0, c: 6.0, unitWeight: 30, unitName: 'miarka' },
  tunczyk: { name: 'Tuńczyk w sosie własnym', kcal: 100, p: 23.5, f: 0.8, c: 0.0, unitWeight: 130, unitName: 'puszka' },
  losos: { name: 'Łosoś świeży pieczony', kcal: 200, p: 20.0, f: 13.0, c: 0.0, unitWeight: 150, unitName: 'porcja' },
  ziemniak: { name: 'Ziemniaki gotowane', kcal: 77, p: 2.0, f: 0.1, c: 17.5, unitWeight: 150, unitName: 'porcja' },
  pancake: { name: 'Pancakes / Naleśniki amerykańskie', kcal: 220, p: 6.5, f: 6.0, c: 35.0, unitWeight: 45, unitName: 'szt.' },
  pancakes: { name: 'Pancakes / Naleśniki amerykańskie', kcal: 220, p: 6.5, f: 6.0, c: 35.0, unitWeight: 45, unitName: 'szt.' },
  pankejk: { name: 'Pancakes / Naleśniki amerykańskie', kcal: 220, p: 6.5, f: 6.0, c: 35.0, unitWeight: 45, unitName: 'szt.' },
  nalesnik: { name: 'Naleśnik klasyczny', kcal: 180, p: 6.0, f: 5.0, c: 27.0, unitWeight: 60, unitName: 'szt.' },
  nutell: { name: 'Krem czekoladowo-orzechowy Nutella', kcal: 539, p: 6.3, f: 30.9, c: 57.5, unitWeight: 20, unitName: 'łyżka' },
  czekolad: { name: 'Czekolada / Krem czekoladowy', kcal: 535, p: 6.0, f: 32.0, c: 56.0, unitWeight: 20, unitName: 'łyżka' },
  orzechow: { name: 'Masło orzechowe 100%', kcal: 588, p: 25.0, f: 50.0, c: 20.0, unitWeight: 20, unitName: 'łyżka' },
  dzem: { name: 'Dżem owocowy', kcal: 200, p: 0.5, f: 0.1, c: 49.0, unitWeight: 25, unitName: 'łyżka' },
  miod: { name: 'Miód naturalny', kcal: 320, p: 0.3, f: 0.0, c: 80.0, unitWeight: 15, unitName: 'łyżeczka' },
  jogurt: { name: 'Jogurt naturalny', kcal: 60, p: 4.0, f: 2.5, c: 5.0, unitWeight: 150, unitName: 'kubek' },
  kefir: { name: 'Kefir naturalny', kcal: 50, p: 3.5, f: 2.0, c: 4.5, unitWeight: 250, unitName: 'szklanka' }
};

// Pamięć podręczna zapytań OpenFoodFacts API
const apiCache = new Map();

export function normalizePl(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'l')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Szuka w lokalnej bazie z uwzględnieniem odmiany polskich słów
 */
export function findLocalFood(query) {
  const q = normalizePl(query);

  // Sprawdź najpierw specyficzne brandy i desery
  if (q.includes('nutell') || q.includes('krem czekolad')) {
    return COMMON_FOODS.nutell;
  }
  if (q.includes('masl') && q.includes('orzech')) {
    return COMMON_FOODS.orzechow;
  }

  // Sortuj po długości klucza malejąco, aby dłuższe, dokładniejsze słowa miały pierwszeństwo
  const sortedEntries = Object.entries(COMMON_FOODS).sort((a, b) => b[0].length - a[0].length);

  for (const [key, val] of sortedEntries) {
    const cleanKey = normalizePl(key);
    if (q.includes(cleanKey)) {
      return val;
    }
  }

  return null;
}

/**
 * Szuka produktu w OpenFoodFacts API (z fallbackiem do bazy wzorcowej)
 * @param {string} query - nazwa produktu (np. "boczek", "jajka", "maslo")
 * @returns {Promise<Object>} Dane odżywcze na 100g
 */
export async function searchOpenFoodFacts(query) {
  const cleanQuery = query.toLowerCase().trim();

  // Sprawdź cache sesji
  if (apiCache.has(cleanQuery)) {
    return apiCache.get(cleanQuery);
  }

  // Sprawdź dopasowanie w lokalnej bazie wzorcowej
  const localMatch = findLocalFood(cleanQuery);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const url = `https://pl.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(cleanQuery)}&search_simple=1&action=process&json=1&page_size=3`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FitCalSportApp - Web - Version 1.0'
      }
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.products && data.products.length > 0) {
        for (const prod of data.products) {
          const nutriments = prod.nutriments;
          if (!nutriments) continue;

          let energyKcal = nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0;
          if (!energyKcal && nutriments['energy_100g']) {
            energyKcal = Math.round(nutriments['energy_100g'] / 4.184);
          }

          if (energyKcal > 0) {
            const result = {
              name: prod.product_name_pl || prod.product_name || (localMatch ? localMatch.name : query),
              kcal: Math.round(energyKcal),
              p: parseFloat((nutriments.proteins_100g || nutriments.proteins || 0).toFixed(1)),
              f: parseFloat((nutriments.fat_100g || nutriments.fat || 0).toFixed(1)),
              c: parseFloat((nutriments.carbohydrates_100g || nutriments.carbohydrates || 0).toFixed(1)),
              source: 'OpenFoodFacts API'
            };
            apiCache.set(cleanQuery, result);
            return result;
          }
        }
      }
    }
  } catch (err) {
    // Tryb offline lub błąd sieci
  }

  // Jeśli brak danych z API, użyj bazy wzorcowej
  if (localMatch) {
    const res = { ...localMatch, source: 'OpenFoodFacts / Baza PTD' };
    apiCache.set(cleanQuery, res);
    return res;
  }

  // Ostateczny szacunek przybliżony
  const fallback = {
    name: query,
    kcal: 150,
    p: 5,
    f: 5,
    c: 20,
    source: 'Szacunek przybliżony'
  };
  return fallback;
}
