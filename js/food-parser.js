/**
 * Inteligentny parser języka naturalnego (język polski) dla posiłków.
 * Rozpoznaje dania ze składników, dania z dodatkami, jednostki domowe i gramatury.
 */

import { searchOpenFoodFacts, COMMON_FOODS, normalizePl, findLocalFood } from './off-api.js';

// Konwersja liczebników słownych na wartości numeryczne
const WORD_NUMBERS = {
  'pol': 0.5,
  'polowka': 0.5,
  'polowe': 0.5,
  'jedno': 1,
  'jeden': 1,
  'jedna': 1,
  'jednej': 1,
  'dwa': 2,
  'dwie': 2,
  'dwoch': 2,
  'trzy': 3,
  'trzech': 3,
  'cztery': 4,
  'czterech': 4,
  'piec': 5,
  'szesc': 6,
  'siedem': 7,
  'osiem': 8,
  'dziewiec': 9,
  'dziesiec': 10
};

// Wagi jednostek domowych (w gramach)
const HOUSEHOLD_MEASURES = [
  { regex: /\b([łl]y[żz][kceiaouyęą]+)\b/i, weight: 15, name: 'łyżka' },
  { regex: /\b([łl]y[żz]ecz[a-z]+)\b/i, weight: 5, name: 'łyżeczka' },
  { regex: /\b(szklank[a-z]+)\b/i, weight: 250, name: 'szklanka' },
  { regex: /\b(krom[a-z]+)\b/i, weight: 35, name: 'kromka' },
  { regex: /\b(plast[a-z]+)\b/i, weight: 25, name: 'plaster' },
  { regex: /\b(garsc[a-z]*)\b/i, weight: 30, name: 'garść' },
  { regex: /\b(worecz[a-z]+)\b/i, weight: 100, name: 'woreczek' },
  { regex: /\b(puszk[a-z]+)\b/i, weight: 130, name: 'puszka' },
  { regex: /\b(opakowan[a-z]+)\b/i, weight: 150, name: 'opakowanie' },
  { regex: /\b(kub[a-z]+)\b/i, weight: 200, name: 'kubek' },
  { regex: /\b(miark[a-z]+)\b/i, weight: 30, name: 'miarka' },
  { regex: /\b(zab[a-z]+|zabek)\b/i, weight: 5, name: 'ząbek' }
];

// Potrawy, które użytkownik często przygotowuje od zera ze składników
const RECIPE_DISHES_REGEX = /^(pancakes?|pankejki?|nalesnik(?:i|a)?|omlet|jajecznic[ae]|owsiank[ae]|koktajl|smoothie)\s+(?:z|ze)\s+(.+)$/i;

/**
 * Główna funkcja analizująca opis posiłku
 */
export async function parseMealText(rawText) {
  if (!rawText || !rawText.trim()) return [];

  const trimmed = rawText.trim();
  let textToParse = trimmed;
  let customTitle = trimmed;

  // 1. Sprawdź schemat "Przepis ze składników" (np. "pancakes z banana i jajek", "omlet z 2 jaj i pomidora")
  // W takim wypadku liczymy TYLKO wymienione składniki, nie dublując gotowych pancakes/omletu!
  const recipeMatch = trimmed.match(RECIPE_DISHES_REGEX);
  if (recipeMatch) {
    const dishType = recipeMatch[1];
    const ingredientsPart = recipeMatch[2];
    customTitle = capitalize(trimmed);
    textToParse = ingredientsPart;
  }

  // 2. Podział na frazy i składniki
  // Zastępujemy spójniki bezpiecznie przecinkami
  let normalizedSeparators = textToParse
    .replace(/(\r\n|\n|\r)/gm, ",")
    .replace(/\b(oraz|dodaje|do tego|plus|\+|z dodatkiem)\b/gi, ",")
    .replace(/\s+i\s+/gi, ",")
    .replace(/\s+na\s+(?=(?:[łl]y[żz][kc]|olej|mas[łl]|oliw|pateln))/gi, ",")
    // Rozbij "z" / "ze" o ile nie dotyczy to stałych związków: "z kurczaka", "z indyka", "z piersi", "z oliwek"
    .replace(/\s+(?:z|ze)\s+(?!(?:kurczak|indyk|piersi?|oliw[a-z]*|tunczyk[a-z]*))/gi, ",");

  const phrases = normalizedSeparators
    .split(/[,;\n]/)
    .map(s => s.trim().replace(/^na\s+/i, ''))
    .filter(s => s.length > 0);

  const items = [];

  for (const phrase of phrases) {
    const parsed = extractIngredientFromPhrase(phrase);
    if (parsed) {
      items.push(parsed);
    }
  }

  // Fallback: jeśli żadna fraza nie dała wyniku, sprawdź pojedyncze słowa kluczowe
  if (items.length === 0) {
    for (const [key, val] of Object.entries(COMMON_FOODS)) {
      if (normalizePl(rawText).includes(key)) {
        items.push({
          rawPhrase: key,
          name: val.name,
          searchQuery: key,
          weightGrams: val.unitWeight || 100,
          unitLabel: '1 porcja'
        });
      }
    }
  }

  // Pobierz wartości odżywcze dla każdego wykrytego składnika
  const results = [];
  for (const item of items) {
    const foodData = await searchOpenFoodFacts(item.searchQuery || item.name);
    const multiplier = item.weightGrams / 100;

    results.push({
      originalPhrase: item.rawPhrase,
      name: foodData.name || item.name,
      weightG: item.weightGrams,
      unitDesc: item.unitLabel,
      kcal: Math.round(foodData.kcal * multiplier),
      protein: parseFloat((foodData.p * multiplier).toFixed(1)),
      fat: parseFloat((foodData.f * multiplier).toFixed(1)),
      carbs: parseFloat((foodData.c * multiplier).toFixed(1)),
      source: foodData.source,
      recipeTitle: customTitle
    });
  }

  return results;
}

/**
 * Wyciąga z pojedynczej frazy wagę/ilość i nazwę produktu
 */
function extractIngredientFromPhrase(phrase) {
  const norm = normalizePl(phrase);
  let weight = 100;
  let unitLabel = '100g';
  let cleanName = phrase;

  // 1. Sprawdź gramy lub ml (np. "150g", "150 g", "200ml")
  const gramMatch = norm.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gram[a-z]*|ml|mililitr[a-z]*)\b/i);
  if (gramMatch) {
    weight = parseFloat(gramMatch[1].replace(',', '.'));
    unitLabel = `${weight}g`;
    cleanName = phrase.replace(new RegExp(gramMatch[0], 'i'), '').trim();
    return finalizeItem(phrase, cleanName, weight, unitLabel);
  }

  // 2. Sprawdź jednostki domowe (łyżka, kromka, szklanka itp.)
  for (const m of HOUSEHOLD_MEASURES) {
    const match = norm.match(m.regex);
    if (match) {
      let count = 1;
      const countMatch = norm.match(new RegExp(`(\\d+|\\w+)\\s+${match[0]}`));
      if (countMatch) {
        const val = countMatch[1];
        if (!isNaN(parseFloat(val))) {
          count = parseFloat(val);
        } else if (WORD_NUMBERS[val]) {
          count = WORD_NUMBERS[val];
        }
      }
      weight = Math.round(m.weight * count);
      unitLabel = `${count} ${m.name} (${weight}g)`;
      cleanName = phrase
        .replace(new RegExp(match[0], 'i'), '')
        .replace(/\b(jedna|jedno|jeden|dwie|dwa|trzy|cztery|\d+)\b/gi, '')
        .trim();
      return finalizeItem(phrase, cleanName, weight, unitLabel);
    }
  }

  // 3. Sprawdź liczbę sztuk (np. "5 pancakes", "2 jaja", "3 banany")
  const countRegex = /\b(\d+|pol|polowka|jedno|jeden|jedna|dwa|dwie|trzy|cztery|piec)\s+([a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)/i;
  const countMatch = norm.match(countRegex);
  if (countMatch) {
    let count = 1;
    const numPart = countMatch[1];
    if (!isNaN(parseFloat(numPart))) {
      count = parseFloat(numPart);
    } else if (WORD_NUMBERS[numPart]) {
      count = WORD_NUMBERS[numPart];
    }

    const prodWord = countMatch[2];
    const localInfo = findLocalFood(prodWord);
    const unitW = localInfo?.unitWeight || 60;
    weight = Math.round(count * unitW);
    unitLabel = `${count} szt. (${weight}g)`;
    cleanName = prodWord;
    return finalizeItem(phrase, cleanName, weight, unitLabel);
  }

  // 4. Jeśli brak liczby, sprawdź czy to znany produkt z bazy
  const localMatch = findLocalFood(phrase);
  if (localMatch) {
    weight = localMatch.unitWeight || 100;
    unitLabel = `1 porcja (${weight}g)`;
    cleanName = localMatch.name;
    return finalizeItem(phrase, cleanName, weight, unitLabel);
  }

  // Usuń słowa zaśmiecające (np. podsmazam, wrzucam, jem, troche)
  cleanName = cleanName
    .replace(/\b(podsmazam|smaze|gotuje|wrzucam|dodaje|zjadlem|zjadlam|troche|mala|duza|porcja)\b/gi, '')
    .trim();

  if (cleanName.length > 1) {
    return finalizeItem(phrase, cleanName, 100, '100g');
  }

  return null;
}

function finalizeItem(rawPhrase, cleanName, weightGrams, unitLabel) {
  const finalSearch = cleanName
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    rawPhrase,
    name: finalSearch || rawPhrase,
    searchQuery: finalSearch || rawPhrase,
    weightGrams: Math.max(5, weightGrams),
    unitLabel
  };
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
