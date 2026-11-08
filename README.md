# Bilans

> **Twój dzień, w równowadze.**

Nowoczesna, minimalistyczna i poręczna sportowa aplikacja mobilna PWA do liczenia kalorii oraz makroskładników (Białko, Tłuszcze, Węglowodany), zintegrowana z bazą **IndexedDB**, **OpenFoodFacts API**, **TinyPlates API** oraz **Dyktafonem** (Web Speech API).

---

## 🍃 Najważniejsze funkcje i nowości

1. **Intuicyjny schemat wpisywania posiłków**:
   - **Danie z dodatkiem**: np. `5 pancakes z kremem czekoladowym nutella` $\rightarrow$ system precyzyjnie liczy bazę (5 szt. pancakes) oraz dodatek (krem Nutella),
   - **Danie ze składników (przepis)**: np. `pancakes z banana i 2 jaj` lub `omlet z 3 jaj i pomidora` $\rightarrow$ system liczy kalorie ze składników bazowych (banan, jajka), nie dublując fikcyjnych gotowych pancakes!
   - **Lista produktów**: np. `2 jaja na łyżce masła dodaje boczek`.
   - **Interaktywna edycja w locie**: w podglądzie możesz szybko zmienić gramaturę każdego składnika lub usunąć pozycję krzyżykiem `×`.

2. **Ręczne dodawanie posiłku (tylko kalorie)**:
   - Dedykowana zakładka **"⚡ Szybkie kalorie (ręcznie)"** w modalu dodawania:
   - Wpisujesz nazwę dania (np. *Pancakes*, *Obiad u mamy*) oraz samą liczbę kalorii (*450 kcal*), a posiłek natychmiast trafia do bilansu dnia.
   - Opcjonalne rozwinięcie dla makroskładników (Białko, Tłuszcz, Węgle).

3. **Inspiracje i rekomendacje z TinyPlates API (`https://www.tinyplates.dev/`)**:
   - Inteligentny moduł zintegrowany z API TinyPlates.
   - Gdy na dany posiłek (np. kolację) pozostaje określony budżet (np. **~500 kcal**), aplikacja w subtelny, estetyczny sposób proponuje zbilansowane danie dopasowane do tej liczby kalorii (np. *Sałatka z grillowanym kurczakiem i awokado 505 kcal* lub *Pieczony łosoś z cukinią i kuskusem 490 kcal*).
   - Przycisk **"+ Dodaj"** pozwala jednym tapnięciem wpisać posiłek do kolacji, a przycisk **"Inna propozycja 🔄"** pozwala wylosować inne danie.

4. **PWA (Progressive Web App - iOS & Android)**:
   - Działa jako natywna aplikacja po dodaniu do ekranu głównego (`standalone`).
   - Pełna obsługa trybu offline dzięki Service Workerowi (`sw.js`).
   - Dedykowane ikony (`icon-192`, `icon-512`, `apple-touch-icon`).
   - Wsparcie dla Safe Area Insets (wcięcie / Dynamic Island w iPhone).

5. **Kalkulator dietetyczny i baza IndexedDB**:
   - Formuła **Mifflina-St Jeora** (złoty standard).
   - Dynamiczne wyliczanie BMR, TDEE, docelowych kalorii oraz **przedziałów makroskładników** (min-max dla Białka, Tłuszczów i Węglowodanów).
   - Nawigacja dniami (`Dzisiaj` / `Wczoraj` / historia).

---

## 🚀 Uruchomienie lokalne

```bash
# Uruchomienie serwera WWW
python3 -m http.server 3000

# Lub za pomocą Node.js
npx serve .
```

Otwórz w przeglądarce: `http://localhost:3000` i wybierz opcję **"Dodaj do ekranu początkowego"** na telefonie.
