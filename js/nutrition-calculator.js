/**
 * Silnik obliczeń dietetycznych oparty na rekomendacjach ACSM, ISSN i Polskiego Towarzystwa Dietetyki.
 * Formuła BMR: Mifflin-St Jeor (złoty standard).
 */

export const ACTIVITY_LEVELS = {
  sedentary: { label: 'Siedzący tryb życia (brak treningów, praca biurowa)', pal: 1.2 },
  light: { label: 'Lekka aktywność (spacery, 1-2 lekkie treningi/tydz.)', pal: 1.375 },
  moderate: { label: 'Umiarkowana aktywność (3-4 regularne treningi/tydz.)', pal: 1.55 },
  heavy: { label: 'Wysoka aktywność (5-6 intensywnych treningów/tydz.)', pal: 1.725 },
  athlete: { label: 'Sportowiec / Praca fizyczna + codzienne treningi', pal: 1.9 }
};

export const GOALS = {
  cut_fast: { label: 'Szybkie odchudzanie (-20% kcal, ~0.7kg/tydz.)', delta: -0.20, proteinGPerKg: 2.2 },
  cut_standard: { label: 'Zdrowe chudnięcie (-15% kcal, ~0.5kg/tydz.)', delta: -0.15, proteinGPerKg: 2.0 },
  cut_slow: { label: 'Łagodna redukcja (-10% kcal, ~0.3kg/tydz.)', delta: -0.10, proteinGPerKg: 1.9 },
  maintain: { label: 'Utrzymanie wagi (rekompozycja ciała)', delta: 0, proteinGPerKg: 1.8 },
  bulk_lean: { label: 'Czysta masa mięśniowa (+10% kcal)', delta: 0.10, proteinGPerKg: 1.9 },
  bulk_fast: { label: 'Szybka budowa masy (+15% kcal)', delta: 0.15, proteinGPerKg: 2.0 }
};

/**
 * Oblicza podstawową przemianę materii (BMR) wzorem Mifflina-St Jeora
 */
export function calculateBMR(gender, weightKg, heightCm, ageYears) {
  const w = parseFloat(weightKg);
  const h = parseFloat(heightCm);
  const a = parseFloat(ageYears);

  if (gender === 'female') {
    return (10 * w) + (6.25 * h) - (5 * a) - 161;
  }
  // male domyślnie
  return (10 * w) + (6.25 * h) - (5 * a) + 5;
}

/**
 * Oblicza całkowite zapotrzebowanie (TDEE) oraz docelowe kalorie i przedziały makroskładników
 */
export function calculateNutritionTargets(profile) {
  const { gender, weightKg, heightCm, ageYears, activityLevel, goal } = profile;

  const bmr = calculateBMR(gender, weightKg, heightCm, ageYears);
  const pal = ACTIVITY_LEVELS[activityLevel]?.pal || 1.375;
  const tdee = Math.round(bmr * pal);

  const goalData = GOALS[goal] || GOALS.cut_standard;
  const targetCalories = Math.round(tdee * (1 + goalData.delta));

  // Sportowe zapotrzebowanie na białko (ISSN zaleca 1.8 - 2.2 g/kg)
  const proteinGPerKg = goalData.proteinGPerKg;
  const targetProteinG = Math.round(parseFloat(weightKg) * proteinGPerKg);
  const proteinCalories = targetProteinG * 4;

  // Tłuszcze: 25-30% całkowitej puli kalorii (nie mniej niż 0.8g/kg dla równowagi hormonalnej)
  let targetFatG = Math.round((targetCalories * 0.25) / 9);
  const minFatG = Math.round(parseFloat(weightKg) * 0.8);
  if (targetFatG < minFatG) {
    targetFatG = minFatG;
  }
  const fatCalories = targetFatG * 9;

  // Węglowodany: uzupełniają resztę puli kalorycznej
  let carbCalories = targetCalories - proteinCalories - fatCalories;
  if (carbCalories < 0) carbCalories = 0;
  const targetCarbsG = Math.round(carbCalories / 4);

  // Przedziały (zakresy optymalne w diecie sportowej)
  return {
    bmr: Math.round(bmr),
    tdee,
    calories: {
      target: targetCalories,
      min: Math.round(targetCalories * 0.95),
      max: Math.round(targetCalories * 1.05)
    },
    protein: {
      target: targetProteinG,
      min: Math.round(targetProteinG * 0.9),
      max: Math.round(targetProteinG * 1.1)
    },
    fat: {
      target: targetFatG,
      min: Math.round(targetFatG * 0.9),
      max: Math.round(targetFatG * 1.15)
    },
    carbs: {
      target: targetCarbsG,
      min: Math.round(targetCarbsG * 0.9),
      max: Math.round(targetCarbsG * 1.1)
    }
  };
}

