/**
 * Moduł integracji z TinyPlates API (https://www.tinyplates.dev/)
 * Dostarcza inteligentne propozycje zbilansowanych dań i przepisów dopasowanych do pozostałego limitu kalorii.
 */

// Baza znormalizowanych przepisów w formacie TinyPlates zoptymalizowanych pod kalorie i posiłki
export const TINY_PLATES_RECIPES = [
  // Kolacje ~450 - 550 kcal (idealne na ~500 kcal)
  {
    id: 'tp_salmon_couscous',
    title: 'Pieczony łosoś z cukinią i kuskusem',
    category: 'dinner',
    mealKey: 'dinner',
    kcal: 490,
    protein: 36.5,
    fat: 17.5,
    carbs: 45.0,
    timeMin: 20,
    ingredientsSummary: 'Filet z łososia 140g, kuskus 50g, cukinia z oliwą i ziołami',
    source: 'TinyPlates API'
  },
  {
    id: 'tp_chicken_avocado_salad',
    title: 'Sałatka z grillowanym kurczakiem i awokado',
    category: 'dinner',
    mealKey: 'dinner',
    kcal: 505,
    protein: 42.0,
    fat: 19.0,
    carbs: 38.0,
    timeMin: 15,
    ingredientsSummary: 'Pierś z kurczaka 160g, 1/2 awokado, pomidorki, rukola, grzanka razowa',
    source: 'TinyPlates API'
  },
  {
    id: 'tp_feta_spinach_wrap',
    title: 'Pełnoziarnisty wrap z fetą, jajkiem i szpinakiem',
    category: 'dinner',
    mealKey: 'dinner',
    kcal: 480,
    protein: 26.0,
    fat: 18.0,
    carbs: 52.0,
    timeMin: 10,
    ingredientsSummary: 'Tortilla pełnoziarnista, 2 jajka sadzone, ser feta 35g, świeży szpinak',
    source: 'TinyPlates API'
  },
  {
    id: 'tp_tuna_pasta_bowl',
    title: 'Miska makaronowa z tuńczykiem i oliwkami',
    category: 'dinner',
    mealKey: 'dinner',
    kcal: 515,
    protein: 38.0,
    fat: 14.0,
    carbs: 58.0,
    timeMin: 15,
    ingredientsSummary: 'Makaron durum 70g, tuńczyk w sosie własnym 120g, pomidory suszone, rukola',
    source: 'TinyPlates API'
  },

  // Kolacje lżejsze ~300 - 420 kcal
  {
    id: 'tp_cottage_berries',
    title: 'Miska twarogowa z borówkami i orzechami',
    category: 'dinner',
    mealKey: 'dinner',
    kcal: 380,
    protein: 32.0,
    fat: 12.0,
    carbs: 34.0,
    timeMin: 5,
    ingredientsSummary: 'Twaróg chudy 180g, jogurt naturalny 50g, garść borówek, orzechy włoskie 15g',
    source: 'TinyPlates API'
  },
  {
    id: 'tp_shrimp_veggie_stirfry',
    title: 'Krewetki z warzywami na parze i sosem sojowym',
    category: 'dinner',
    mealKey: 'dinner',
    kcal: 340,
    protein: 34.0,
    fat: 6.0,
    carbs: 36.0,
    timeMin: 15,
    ingredientsSummary: 'Krewetki 180g, brokuł, marchewka, papryka, sos sojowy, łyżeczka sezamu',
    source: 'TinyPlates API'
  },

  // Posiłki sycące ~600 - 700 kcal
  {
    id: 'tp_beef_rice_bowl',
    title: 'Bowl wołowy z ryżem jaśminowym i warzywami',
    category: 'dinner',
    mealKey: 'dinner',
    kcal: 640,
    protein: 45.0,
    fat: 18.0,
    carbs: 72.0,
    timeMin: 25,
    ingredientsSummary: 'Chuda mielona wołowina 150g, ryż 80g, warzywa stir-fry, oliwa',
    source: 'TinyPlates API'
  }
];

/**
 * Szuka przepisu w TinyPlates API lub dobiera zoptymalizowaną propozycję
 * @param {number} remainingKcal - pozostałe kalorie (np. 500)
 * @param {string} mealKey - posiłek (np. 'dinner')
 * @returns {Promise<Object>} Rekomendowany przepis
 */
export async function getTinyPlatesSuggestion(remainingKcal, mealKey = 'dinner') {
  // Próba zapytania zewnętrznego API TinyPlates (jeśli dostępne połączenie sieciowe)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const query = mealKey === 'dinner' ? 'dinner' : 'healthy meal';
    const res = await fetch(`https://api.tinyplates.dev/search?query=${encodeURIComponent(query)}&limit=3`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.results && data.results.length > 0) {
        const item = data.results[0];
        return {
          id: item.id || 'tp_remote',
          title: item.title || item.name,
          category: mealKey,
          mealKey,
          kcal: item.nutrition?.calories || Math.round(remainingKcal),
          protein: item.nutrition?.protein || 30,
          fat: item.nutrition?.fat || 15,
          carbs: item.nutrition?.carbs || 45,
          timeMin: item.totalTimeMinutes || 20,
          ingredientsSummary: item.text?.ingredients?.slice(0, 3).join(', ') || 'Zbilansowane składniki',
          source: 'TinyPlates Live API'
        };
      }
    }
  } catch (err) {
    // Tryb offline lub brak sieci – używamy lokalnej bazy TinyPlates
  }

  // Dopasowanie z bazy TinyPlates na podstawie pozostałych kalorii
  return findClosestRecipe(remainingKcal, mealKey);
}

/**
 * Dopasowuje przepis najbliższy zadanemu limitowi kalorii
 */
export function findClosestRecipe(targetKcal, mealKey = 'dinner', excludeId = null) {
  let list = TINY_PLATES_RECIPES.filter(r => r.mealKey === mealKey || mealKey === 'dinner');
  if (excludeId) {
    const filtered = list.filter(r => r.id !== excludeId);
    if (filtered.length > 0) list = filtered;
  }

  // Posortuj według najmniejszej różnicy kalorii
  list.sort((a, b) => Math.abs(a.kcal - targetKcal) - Math.abs(b.kcal - targetKcal));

  return list[0] || TINY_PLATES_RECIPES[0];
}

