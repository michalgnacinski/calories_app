/**
 * bilans. - Główny kontroler aplikacji
 * Integruje IndexedDB, OpenFoodFacts API, Dyktafon oraz estetykę inspirowaną designem ze zdjęcia.
 */

import { calculateNutritionTargets } from './nutrition-calculator.js';
import { parseMealText } from './food-parser.js';
import { VoiceDictation } from './speech-recognition.js';
import { db } from './db.js';

class BilansApp {
  constructor() {
    this.user = null;
    this.targets = null;
    this.selectedDate = this.getTodayDateString();
    this.mealsForSelectedDate = [];
    this.activeMealKey = 'breakfast';
    this.pendingParsedItems = [];

    this.initElements();
    this.initVoice();
    this.bindEvents();
    this.initApp();
    this.initServiceWorker();
  }

  getTodayDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  getYesterdayDateString() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }

  formatDatePolish(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const months = [
      'Stycznia', 'Lutego', 'Marca', 'Kwietnia', 'Maja', 'Czerwca',
      'Lipca', 'Sierpnia', 'Września', 'Października', 'Listopada', 'Grudnia'
    ];

    const todayStr = this.getTodayDateString();
    const yesterdayStr = this.getYesterdayDateString();

    let prefix = '';
    if (dateStr === todayStr) prefix = 'Dzisiaj · ';
    else if (dateStr === yesterdayStr) prefix = 'Wczoraj · ';

    return `${prefix}${d} ${months[date.getMonth()]}`;
  }

  initElements() {
    // Ekrany
    this.viewOnboarding = document.getElementById('view-onboarding');
    this.viewDashboard = document.getElementById('view-dashboard');

    // Nagłówek i powitanie
    this.dashGreetingName = document.getElementById('dash-greeting-name');
    this.avatarInitial = document.getElementById('avatar-initial');
    this.userAvatarBtn = document.getElementById('user-avatar-btn');
    this.btnRefreshDay = document.getElementById('btn-refresh-day');

    // Nawigacja daty
    this.currentDateLabel = document.getElementById('current-date-label');
    this.btnPrevDay = document.getElementById('btn-prev-day');
    this.btnNextDay = document.getElementById('btn-next-day');
    this.pillYesterday = document.getElementById('pill-yesterday');
    this.pillToday = document.getElementById('pill-today');

    // Formularz ankiety
    this.profileForm = document.getElementById('profile-form');
    this.inputName = document.getElementById('input-name');
    this.inputGender = document.getElementById('input-gender');
    this.inputAge = document.getElementById('input-age');
    this.inputWeight = document.getElementById('input-weight');
    this.inputHeight = document.getElementById('input-height');
    this.selectActivity = document.getElementById('select-activity');
    this.selectGoal = document.getElementById('select-goal');
    this.previewBmr = document.getElementById('preview-bmr');
    this.previewTdee = document.getElementById('preview-tdee');
    this.previewTarget = document.getElementById('preview-target');

    // Karta Bilansu Dnia
    this.dashCalConsumed = document.getElementById('dash-cal-consumed');
    this.dashCalTargetLabel = document.getElementById('dash-cal-target-label');
    this.dashCircleProgress = document.getElementById('dash-circle-progress');
    this.dashCirclePercent = document.getElementById('dash-circle-percent');
    this.dashBottomLabel = document.getElementById('dash-bottom-label');
    this.dashBottomVal = document.getElementById('dash-bottom-val');
    this.btnEditStatus = document.getElementById('btn-edit-status');

    // Karta Makro
    this.dashPVal = document.getElementById('dash-p-val');
    this.dashPTargetSub = document.getElementById('dash-p-target-sub');
    this.dashCVal = document.getElementById('dash-c-val');
    this.dashCTargetSub = document.getElementById('dash-c-target-sub');
    this.dashFVal = document.getElementById('dash-f-val');
    this.dashFTargetSub = document.getElementById('dash-f-target-sub');

    // Modal dodawania
    this.mealModal = document.getElementById('meal-modal');
    this.modalCloseBtn = document.getElementById('modal-close-btn');
    this.modalMealName = document.getElementById('modal-meal-name');
    this.mealTextInput = document.getElementById('meal-text-input');
    this.voiceRecordBtn = document.getElementById('voice-record-btn');
    this.voiceLabel = document.getElementById('voice-label');
    this.voiceStatusText = document.getElementById('voice-status-text');
    this.btnParseAndAdd = document.getElementById('btn-parse-and-add');
    this.previewBox = document.getElementById('preview-box');
    this.previewTotalCal = document.getElementById('preview-total-cal');
    this.previewItemsList = document.getElementById('preview-items-list');
    this.btnConfirmAdd = document.getElementById('btn-confirm-add');
    this.btnOpenGlobalAdd = document.getElementById('btn-open-global-add');

    // Toast
    this.toast = document.getElementById('toast');
  }

  async initApp() {
    try {
      await db.init();
      const existingUser = await db.getActiveUser();

      if (existingUser && existingUser.name) {
        this.user = existingUser;
        this.targets = existingUser.targets || calculateNutritionTargets(existingUser);
        this.showDashboard();
        await this.loadAndRenderMealsForDate();
      } else {
        // Pierwsze odpalenie aplikacji -> pokazujemy formularz ankiety
        this.showOnboarding();
        this.refreshOnboardingPreview();
      }
    } catch (e) {
      console.error('Błąd inicjalizacji bazy danych:', e);
      this.showOnboarding();
    }
  }

  showOnboarding() {
    this.viewDashboard.classList.remove('active');
    this.viewOnboarding.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  showDashboard() {
    this.viewOnboarding.classList.remove('active');
    this.viewDashboard.classList.add('active');

    // Ustaw imię użytkownika i avatar
    const name = this.user?.name || 'Użytkownik';
    this.dashGreetingName.textContent = `CZEŚĆ, ${name.toUpperCase()}`;
    this.avatarInitial.textContent = name.charAt(0).toUpperCase();

    this.updateDateUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  initVoice() {
    this.voiceDictation = new VoiceDictation({
      onStart: () => {
        this.voiceRecordBtn.classList.add('recording');
        this.voiceLabel.textContent = 'Zatrzymaj';
        this.voiceStatusText.textContent = 'Słucham... Wypowiedz składniki posiłku po polsku';
      },
      onEnd: () => {
        this.voiceRecordBtn.classList.remove('recording');
        this.voiceLabel.textContent = 'Nagraj';
        this.voiceStatusText.textContent = 'Nagranie zakończone. Możesz przeliczyć kalorie.';
      },
      onResult: (text, isFinal) => {
        this.mealTextInput.value = text;
      },
      onError: (err) => {
        this.voiceRecordBtn.classList.remove('recording');
        this.voiceLabel.textContent = 'Nagraj';
        this.voiceStatusText.textContent = `Błąd mikrofonu: ${err}. Wpisz składniki ręcznie.`;
      }
    });
  }

  bindEvents() {
    // Przełącznik płci w formularzu
    document.querySelectorAll('.gender-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.gender-select-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.inputGender.value = btn.dataset.gender;
        this.refreshOnboardingPreview();
      });
    });

    // Dynamiczny podgląd ankiety
    [this.inputAge, this.inputWeight, this.inputHeight, this.selectActivity, this.selectGoal].forEach(el => {
      el.addEventListener('input', () => this.refreshOnboardingPreview());
      el.addEventListener('change', () => this.refreshOnboardingPreview());
    });

    // Zapis ankiety do bazy danych IndexedDB
    this.profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSaveProfile();
    });

    // Kliknięcie w avatar lub status "W trakcie" -> edycja profilu
    this.userAvatarBtn.addEventListener('click', () => this.editUserProfile());
    this.btnEditStatus.addEventListener('click', () => this.editUserProfile());

    // Odświeżenie danych dnia
    this.btnRefreshDay.addEventListener('click', async () => {
      await this.loadAndRenderMealsForDate();
      this.showToast('Zaktualizowano bilans');
    });

    // Nawigacja datami (Wczoraj / Dzisiaj / Strzałki)
    this.pillToday.addEventListener('click', () => this.changeDate(this.getTodayDateString()));
    this.pillYesterday.addEventListener('click', () => this.changeDate(this.getYesterdayDateString()));

    this.btnPrevDay.addEventListener('click', () => {
      const d = new Date(this.selectedDate);
      d.setDate(d.getDate() - 1);
      this.changeDate(d.toISOString().split('T')[0]);
    });

    this.btnNextDay.addEventListener('click', () => {
      const d = new Date(this.selectedDate);
      d.setDate(d.getDate() + 1);
      this.changeDate(d.toISOString().split('T')[0]);
    });

    // Przyciski dodawania do konkretnego posiłku
    document.querySelectorAll('.quick-add-link').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openMealModal(btn.dataset.addMeal);
      });
    });

    // Przycisk "+ Dodaj" na górze sekcji posiłków
    this.btnOpenGlobalAdd.addEventListener('click', () => {
      this.openMealModal('breakfast');
    });

    // Kliknięcie w kartę posiłku rozwija/zwija szczegóły składników
    document.querySelectorAll('.meal-entry-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.quick-add-link') || e.target.closest('.food-del-btn')) return;
        const mealKey = card.dataset.mealKey;
        const list = document.getElementById(`items-list-${mealKey}`);
        if (list && list.children.length > 0) {
          const isHidden = list.style.display === 'none';
          list.style.display = isHidden ? 'flex' : 'none';
        }
      });
    });

    // Wybór posiłku w modalu
    document.querySelectorAll('.pill-choice').forEach(pill => {
      pill.addEventListener('click', () => {
        this.selectModalMeal(pill.dataset.targetMeal);
      });
    });

    // Zamknięcie modalu
    this.modalCloseBtn.addEventListener('click', () => this.closeMealModal());
    this.mealModal.addEventListener('click', (e) => {
      if (e.target === this.mealModal) this.closeMealModal();
    });

    // Przycisk dyktafonu
    this.voiceRecordBtn.addEventListener('click', () => {
      this.voiceDictation.toggle();
    });

    // Przeliczenie z OpenFoodFacts
    this.btnParseAndAdd.addEventListener('click', () => this.handleParseFood());

    // Zatwierdzenie składników i zapis do bazy IndexedDB
    this.btnConfirmAdd.addEventListener('click', () => this.handleConfirmAdd());
  }

  refreshOnboardingPreview() {
    const tempProfile = {
      gender: this.inputGender.value,
      ageYears: parseInt(this.inputAge.value) || 28,
      weightKg: parseFloat(this.inputWeight.value) || 78,
      heightCm: parseFloat(this.inputHeight.value) || 180,
      activityLevel: this.selectActivity.value,
      goal: this.selectGoal.value
    };

    const targets = calculateNutritionTargets(tempProfile);
    this.previewBmr.textContent = `${targets.bmr} kcal`;
    this.previewTdee.textContent = `${targets.tdee} kcal`;
    this.previewTarget.textContent = `${targets.calories.target} kcal (${targets.calories.min} - ${targets.calories.max} kcal)`;
  }

  async handleSaveProfile() {
    const name = this.inputName.value.trim() || 'Piotr';
    const profile = {
      id: 'default_user',
      name: name,
      gender: this.inputGender.value,
      ageYears: parseInt(this.inputAge.value),
      weightKg: parseFloat(this.inputWeight.value),
      heightCm: parseFloat(this.inputHeight.value),
      activityLevel: this.selectActivity.value,
      goal: this.selectGoal.value
    };

    const targets = calculateNutritionTargets(profile);
    profile.targets = targets;

    // Trwały zapis w bazie danych IndexedDB
    await db.saveUser(profile);
    this.user = profile;
    this.targets = targets;

    this.showDashboard();
    await this.loadAndRenderMealsForDate();
    this.showToast(`Witaj, ${name}! Twoje dane zostały zapamiętane.`);
  }

  editUserProfile() {
    if (this.user) {
      this.inputName.value = this.user.name || '';
      this.inputGender.value = this.user.gender;
      document.querySelectorAll('.gender-select-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.gender === this.user.gender);
      });
      this.inputAge.value = this.user.ageYears;
      this.inputWeight.value = this.user.weightKg;
      this.inputHeight.value = this.user.heightCm;
      this.selectActivity.value = this.user.activityLevel;
      this.selectGoal.value = this.user.goal;
      this.refreshOnboardingPreview();
    }
    this.showOnboarding();
  }

  async changeDate(newDateStr) {
    this.selectedDate = newDateStr;
    this.updateDateUI();
    await this.loadAndRenderMealsForDate();
  }

  updateDateUI() {
    this.currentDateLabel.textContent = this.formatDatePolish(this.selectedDate);

    const isToday = this.selectedDate === this.getTodayDateString();
    const isYesterday = this.selectedDate === this.getYesterdayDateString();

    this.pillToday.classList.toggle('active', isToday);
    this.pillYesterday.classList.toggle('active', isYesterday);
  }

  // Ładowanie posiłków z bazy danych IndexedDB dla wybranej daty
  async loadAndRenderMealsForDate() {
    if (!this.user) return;

    this.mealsForSelectedDate = await db.getMealsByDate(this.user.id, this.selectedDate);
    this.renderDashboard();
  }

  renderDashboard() {
    if (!this.targets) return;

    let totalKcal = 0;
    let totalP = 0;
    let totalF = 0;
    let totalC = 0;

    const mealCategories = ['breakfast', 'brunch', 'lunch', 'snack', 'dinner'];
    const mealsByKey = {
      breakfast: [],
      brunch: [],
      lunch: [],
      snack: [],
      dinner: []
    };

    // Podział pobranych posiłków z bazy na kategorie
    this.mealsForSelectedDate.forEach(mealRecord => {
      const k = mealRecord.mealKey || 'breakfast';
      if (mealsByKey[k]) {
        mealsByKey[k].push(mealRecord);
        totalKcal += mealRecord.totalKcal || 0;
        totalP += mealRecord.totalP || 0;
        totalF += mealRecord.totalF || 0;
        totalC += mealRecord.totalC || 0;
      }
    });

    // 1. Karta Główna BILANS DNIA
    const targetKcal = this.targets.calories.target;
    this.dashCalConsumed.textContent = totalKcal;
    this.dashCalTargetLabel.textContent = `z celu ${targetKcal} kcal`;

    // Obwód koła r=37: 2 * Math.PI * 37 ≈ 232.5
    const circumference = 232;
    const percentRatio = totalKcal > 0 ? (totalKcal / targetKcal) : 0;
    const percentInt = Math.round(percentRatio * 100);
    this.dashCirclePercent.innerHTML = `${percentInt}<span>%</span>`;

    const strokeDash = Math.max(0, circumference - (Math.min(1.5, percentRatio) * circumference));
    this.dashCircleProgress.style.strokeDashoffset = strokeDash;

    // Dolny wskaźnik bilansu
    if (totalKcal >= targetKcal) {
      this.dashBottomLabel.textContent = 'Powyżej celu spożycia';
      this.dashBottomVal.textContent = `${totalKcal - targetKcal} kcal`;
    } else {
      this.dashBottomLabel.textContent = 'Pozostało do celu';
      this.dashBottomVal.textContent = `${targetKcal - totalKcal} kcal`;
    }

    // 2. Karta Makroskładników (3 kolumny ze zdjęcia)
    this.dashPVal.innerHTML = `≥ ${totalP.toFixed(1)} <span>g</span>`;
    this.dashPTargetSub.textContent = `cel: ${this.targets.protein.min}-${this.targets.protein.max}g`;

    this.dashCVal.innerHTML = `≥ ${totalC.toFixed(1)} <span>g</span>`;
    this.dashCTargetSub.textContent = `cel: ${this.targets.carbs.min}-${this.targets.carbs.max}g`;

    this.dashFVal.innerHTML = `≥ ${totalF.toFixed(1)} <span>g</span>`;
    this.dashFTargetSub.textContent = `cel: ${this.targets.fat.min}-${this.targets.fat.max}g`;

    // 3. Sekcje posiłków (Śniadanie, 2 Śniadanie, Obiad, Przekąska, Kolacja)
    mealCategories.forEach(key => {
      const records = mealsByKey[key];
      const calBadge = document.getElementById(`meal-cal-${key}`);
      const nameLabel = document.getElementById(`meal-name-${key}`);
      const listEl = document.getElementById(`items-list-${key}`);

      let catKcal = 0;
      records.forEach(r => catKcal += (r.totalKcal || 0));

      if (calBadge) calBadge.textContent = catKcal;

      if (records.length === 0) {
        if (nameLabel) nameLabel.textContent = 'Kliknij, aby dodać posiłek';
        if (listEl) {
          listEl.innerHTML = '';
          listEl.style.display = 'none';
        }
      } else {
        // Tytuł posiłku (ostatnio dodany wpis lub lista)
        const summaryTitles = records.map(r => r.rawTitle || (r.items && r.items[0]?.name)).filter(Boolean);
        if (nameLabel) {
          nameLabel.textContent = summaryTitles.slice(-1)[0] || 'Zapisany posiłek';
        }

        if (listEl) {
          listEl.innerHTML = records.map(r => `
            <div class="single-food-item">
              <div>
                <span class="food-title">${r.rawTitle || 'Posiłek'}</span>
                <span class="food-macros-line"> (${r.totalKcal} kcal • B: ${r.totalP}g • T: ${r.totalF}g • W: ${r.totalC}g)</span>
              </div>
              <button type="button" class="food-del-btn" data-delete-id="${r.id}" title="Usuń">&times;</button>
            </div>
          `).join('');

          listEl.style.display = 'flex';

          // Usuwanie pojedynczego posiłku z bazy IndexedDB
          listEl.querySelectorAll('.food-del-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              const id = Number(btn.dataset.deleteId);
              await db.deleteMeal(id);
              await this.loadAndRenderMealsForDate();
              this.showToast('Usunięto pozycję');
            });
          });
        }
      }
    });
  }

  // Modal posiłków
  openMealModal(mealKey = 'breakfast') {
    this.activeMealKey = mealKey;
    this.selectModalMeal(mealKey);
    this.mealTextInput.value = '';
    this.previewBox.style.display = 'none';
    this.pendingParsedItems = [];
    this.voiceStatusText.textContent = 'Wskazówka: możesz wpisać lub nagrać posiłek naturalnym językiem.';
    this.mealModal.classList.add('active');
    setTimeout(() => this.mealTextInput.focus(), 200);
  }

  closeMealModal() {
    this.voiceDictation.stop();
    this.mealModal.classList.remove('active');
  }

  selectModalMeal(mealKey) {
    this.activeMealKey = mealKey;
    const names = {
      breakfast: 'Śniadanie',
      brunch: '2 Śniadanie',
      lunch: 'Obiad',
      snack: 'Przekąska',
      dinner: 'Kolacja'
    };
    this.modalMealName.textContent = `Dodaj: ${names[mealKey] || 'Posiłek'}`;

    document.querySelectorAll('.pill-choice').forEach(pill => {
      pill.classList.toggle('selected', pill.dataset.targetMeal === mealKey);
    });
  }

  async handleParseFood() {
    const rawText = this.mealTextInput.value.trim();
    if (!rawText) {
      alert('Wpisz lub nagraj składniki posiłku przed zatwierdzeniem.');
      return;
    }

    this.btnParseAndAdd.disabled = true;
    this.btnParseAndAdd.innerHTML = `<span>Pobieram z OpenFoodFacts...</span> <span>⏳</span>`;

    try {
      const items = await parseMealText(rawText);
      this.pendingParsedItems = items;
      this.renderParsedPreview(items);
    } catch (err) {
      console.error('Błąd parsowania posiłku:', err);
      alert('Wystąpił problem z pobieraniem danych. Spróbuj ponownie.');
    } finally {
      this.btnParseAndAdd.disabled = false;
      this.btnParseAndAdd.innerHTML = `<span>Przelicz kalorie</span> <span>⚡</span>`;
    }
  }

  renderParsedPreview(items) {
    if (!items || items.length === 0) {
      this.previewBox.style.display = 'flex';
      this.previewItemsList.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding: 6px;">Nie rozpoznano konkretnych produktów spożywczych. Spróbuj opisać np.: "podsmazam 2 jaja na lyzce masła dodaje boczek".</div>`;
      this.previewTotalCal.textContent = '0 kcal';
      this.btnConfirmAdd.style.display = 'none';
      return;
    }

    this.btnConfirmAdd.style.display = 'flex';
    this.previewBox.style.display = 'flex';

    const totalKcal = items.reduce((sum, item) => sum + item.kcal, 0);
    this.previewTotalCal.textContent = `Razem: ${totalKcal} kcal`;

    this.previewItemsList.innerHTML = items.map((item, idx) => `
      <div class="single-food-item">
        <div>
          <div class="food-title">${item.name} (${item.unitDesc || item.weightG + 'g'})</div>
          <div class="food-macros-line">${item.source} • B: ${item.protein}g | T: ${item.fat}g | W: ${item.carbs}g</div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-weight: 800; color: var(--green-dark);">${item.kcal} kcal</span>
          <button type="button" class="food-del-btn" data-preview-idx="${idx}">&times;</button>
        </div>
      </div>
    `).join('');

    this.previewItemsList.querySelectorAll('.food-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.previewIdx);
        this.pendingParsedItems.splice(idx, 1);
        this.renderParsedPreview(this.pendingParsedItems);
      });
    });
  }

  // Zapis do bazy danych IndexedDB
  async handleConfirmAdd() {
    if (!this.pendingParsedItems || this.pendingParsedItems.length === 0) return;

    const rawTitle = this.mealTextInput.value.trim();
    let totalKcal = 0;
    let totalP = 0;
    let totalF = 0;
    let totalC = 0;

    this.pendingParsedItems.forEach(it => {
      totalKcal += it.kcal || 0;
      totalP += it.protein || 0;
      totalF += it.fat || 0;
      totalC += it.carbs || 0;
    });

    const mealRecord = {
      userId: this.user.id,
      date: this.selectedDate,
      mealKey: this.activeMealKey,
      rawTitle: rawTitle,
      items: this.pendingParsedItems,
      totalKcal,
      totalP: parseFloat(totalP.toFixed(1)),
      totalF: parseFloat(totalF.toFixed(1)),
      totalC: parseFloat(totalC.toFixed(1))
    };

    // Zapis w IndexedDB
    await db.saveMealItem(mealRecord);

    this.closeMealModal();
    await this.loadAndRenderMealsForDate();
    this.showToast('Posiłek dodany do bilansu!');
  }

  showToast(message) {
    this.toast.textContent = message;
    this.toast.classList.add('show');
    setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2400);
  }

  initServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('[bilans.] Service Worker aktywny:', reg.scope))
          .catch(err => console.warn('[bilans.] SW warning:', err));
      });
    }
  }
}

// Inicjalizacja aplikacji
window.addEventListener('DOMContentLoaded', () => {
  window.bilansApp = new BilansApp();
});
