# Bilans

> **Twój dzień, w równowadze.**

Nowoczesna, minimalistyczna i poręczna sportowa aplikacja mobilna PWA do liczenia kalorii oraz makroskładników (Białko, Tłuszcze, Węglowodany), zintegrowana z bazą **IndexedDB**, **OpenFoodFacts API** oraz **Dyktafonem** (Web Speech API).

---

## 🍃 Najważniejsze funkcje

1. **PWA (Progressive Web App - iOS & Android)**:
   - Działa jako natywna aplikacja po dodaniu do ekranu głównego (`standalone`).
   - Pełna obsługa trybu offline dzięki Service Workerowi (`sw.js`).
   - Dedykowane ikony (`icon-192`, `icon-512`, `apple-touch-icon`).
   - Wsparcie dla Safe Area Insets (wcięcie / Dynamic Island w iPhone).

2. **Pierwsze odpalenie i personalizacja**:
   - Rejestracja parametrów użytkownika: Imię, płeć biologiczna, wiek, waga, wzrost, poziom aktywności (PAL), cel sylwetkowy.
   - Trwałe zapamiętanie profilu w bazie IndexedDB.
   - Spersonalizowane powitanie: `CZEŚĆ, {IMIĘ}` oraz awatar z inicjałem.

3. **Kalkulator dietetyczny**:
   - Formuła **Mifflina-St Jeora** (złoty standard).
   - Dynamiczne wyliczanie BMR, TDEE, docelowych kalorii oraz **przedziałów makroskładników** (min-max dla Białka, Tłuszczów i Węglowodanów).

4. **Karta Główna BILANS DNIA**:
   - Ciemnozielona elegancka karta z okręgiem postępu (`% celu`).
   - 3-kolumnowa, czytelna karta makroskładników ze wskaźnikami `≥ {wartość} g`.
   - Nawigacja dniami (`Dzisiaj` / `Wczoraj` / historia).

5. **2 sposoby błyskawicznego dodawania posiłków**:
   - **Tekst naturalny**: wpisujesz np. `podsmazam 2 jaja na lyzce masła dodaje boczek` – inteligentny parser języka polskiego rozpoznaje składniki i gramatury, odpytując publiczne API **OpenFoodFacts**.
   - **Dyktafon (Voice-to-Text)**: nagraj swoją wypowiedź głosem, a system przekonwertuje ją na tekst i policzy kalorie.
   - 5 sekcji posiłków: **Śniadanie**, **2 Śniadanie**, **Obiad**, **Przekąska**, **Kolacja**.

---

## 🚀 Uruchomienie lokalne

```bash
# Uruchomienie serwera WWW
python3 -m http.server 3000

# Lub za pomocą Node.js
npx serve .
```

Otwórz w przeglądarce: `http://localhost:3000` i wybierz opcję **"Dodaj do ekranu początkowego"** na telefonie.
