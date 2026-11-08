# Bilans

> **Twój dzień, w równowadze.**

Nowoczesna, minimalistyczna i poręczna sportowa aplikacja mobilna PWA do liczenia kalorii oraz makroskładników (Białko, Tłuszcze, Węglowodany), zintegrowana z bazą **IndexedDB**, **Google Gemini Vision AI (rozpoznawanie dań ze zdjęć)**, **OpenFoodFacts API**, **TinyPlates API** oraz **Dyktafonem** (Web Speech API).

---

## 🍃 Najważniejsze funkcje i nowości

1. **📸 Rozpoznawanie dań i kalorii ze zdjęć (Gemini Vision AI)**:
   - W oknie dodawania posiłku kliknij **`📸 Zdjęcie`**, aby zrobić zdjęcie potrawy aparatem telefonu lub wybrać je z galerii.
   - Zdjęcie jest automatycznie kompresowane na urządzeniu (z 10 MB do ~100 KB) i analizowane przez sztuczną inteligencję.
   - Model automatycznie rozpoznaje danie, rozbija je na składniki, szacuje wielkości porcji w gramach i wylicza kalorie oraz makro (B/T/W).
   - W oknie podglądu możesz od razu zweryfikować lub skorygować wagi i jednym kliknięciem dodać posiłek do swojego dnia.

2. **Intuicyjny schemat wpisywania posiłków**:
   - **Danie z dodatkiem**: np. `5 pancakes z kremem czekoladowym nutella` $\rightarrow$ system precyzyjnie liczy bazę (5 szt. pancakes) oraz dodatek (krem Nutella),
   - **Danie ze składników (przepis)**: np. `pancakes z banana i 2 jaj` lub `omlet z 3 jaj i pomidora` $\rightarrow$ system liczy kalorie ze składników bazowych (banan, jajka), nie dublując gotowych pancakes!
   - **Lista produktów**: np. `2 jaja na łyżce masła dodaje boczek`.
   - **Interaktywna edycja w locie**: w podglądzie możesz szybko zmienić gramaturę każdego składnika lub usunąć pozycję krzyżykiem `×`.

3. **Ręczne dodawanie posiłku (tylko kalorie)**:
   - Dedykowana zakładka **"⚡ Szybkie kalorie (ręcznie)"** w modalu dodawania:
   - Wpisujesz nazwę dania (np. *Pancakes*, *Obiad u mamy*) oraz samą liczbę kalorii (*450 kcal*), a posiłek natychmiast trafia do bilansu dnia.
   - Opcjonalne rozwinięcie dla makroskładników (Białko, Tłuszcz, Węgle).

4. **Inspiracje i rekomendacje z TinyPlates API (`https://www.tinyplates.dev/`)**:
   - Gdy na dany posiłek (np. kolację) pozostaje określony budżet (np. **~500 kcal**), aplikacja w subtelny sposób proponuje zbilansowane danie dopasowane do tej liczby kalorii.
   - Przycisk **"+ Dodaj"** pozwala jednym tapnięciem wpisać posiłek do kolacji, a przycisk **"Inna propozycja 🔄"** pozwala wylosować inne danie.

5. **PWA (Progressive Web App - iOS & Android)**:
   - Działa jako natywna aplikacja po dodaniu do ekranu głównego (`standalone`).
   - Pełna obsługa trybu offline dzięki Service Workerowi (`sw.js`).
   - Dedykowane ikony (`icon-192`, `icon-512`, `apple-touch-icon`).
   - Wsparcie dla Safe Area Insets (wcięcie / Dynamic Island w iPhone).

---

## 🔑 Jak skonfigurować darmowy klucz Google Gemini AI (w 1 minutę)

Aby aktywować analizę posiłków ze zdjęć:
1. Wejdź na oficjalną stronę: **[aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)**
2. Zaloguj się dowolnym kontem Google.
3. Kliknij niebieski przycisk **"Create API key"** (darmowy, bez podawania karty płatniczej).
4. Skopiuj wygenerowany klucz (zaczyna się od `AIzaSy...`).
5. W aplikacji **Bilans** kliknij przycisk **`📸 Zdjęcie`** i wklej swój klucz (zostanie zapisany lokalnie w Twojej przeglądarce).

---

## 🚀 Uruchomienie lokalne

```bash
# Uruchomienie serwera WWW
python3 -m http.server 3000

# Lub za pomocą Node.js
npx serve .
```

Otwórz w przeglądarce: `http://localhost:3000` i wybierz opcję **"Dodaj do ekranu początkowego"** na telefonie.
