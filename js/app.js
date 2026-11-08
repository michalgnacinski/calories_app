/**
 * bilans. - Główny kontroler aplikacji
 * Integruje IndexedDB, OpenFoodFacts API, Dyktafon, Ręczne wprowadzanie oraz TinyPlates API.
 */

import { calculateNutritionTargets } from './nutrition-calculator.js';
import { parseMealText } from './food-parser.js';
import { VoiceDictation } from './speech-recognition.js';
import { db } from './db.js';
import { getTinyPlatesSuggestion, findClosestRecipe } from './tinyplates.js';
import { compressImage, analyzeFoodImage } from './vision-scanner.js';

class BilansApp {
  constructor() {
    this.user = null;
    this.targets = null;
    this.selectedDate = this.getTodayDateString();
    this.mealsForSelectedDate = [];
    this.activeMealKey = 'breakfast';
    this.activeInputMode = 'ai';
    this.pendingParsedItems = [];
    this.currentTinyPlate = null;

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

    // Modal dodawania i zakładki trybów
    this.mealModal = document.getElementById('meal-modal');
    this.modalCloseBtn = document.getElementById('modal-close-btn');
    this.modalMealName = document.getElementById('modal-meal-name');
    this.tabModeAi = document.getElementById('tab-mode-ai');
    this.tabModeManual = document.getElementById('tab-mode-manual');
    this.sectionModeAi = document.getElementById('section-mode-ai');
    this.sectionModeManual = document.getElementById('section-mode-manual');

    // Elementy trybu AI / Opis
    this.mealTextInput = document.getElementById('meal-text-input');
    this.voiceRecordBtn = document.getElementById('voice-record-btn');
    this.voiceLabel = document.getElementById('voice-label');
    this.voiceStatusText = document.getElementById('voice-status-text');
    this.cameraScanBtn = document.getElementById('camera-scan-btn');
    this.cameraFileInput = document.getElementById('camera-file-input');
    this.aiPhotoPreviewWrap = document.getElementById('ai-photo-preview-wrap');
    this.aiPhotoThumb = document.getElementById('ai-photo-thumb');
    this.aiPhotoStatus = document.getElementById('ai-photo-status');
    this.aiPhotoCancelBtn = document.getElementById('ai-photo-cancel-btn');
    this.btnParseAndAdd = document.getElementById('btn-parse-and-add');
    this.previewBox = document.getElementById('preview-box');
    this.previewTitleBadge = document.getElementById('preview-title-badge');
    this.previewTotalCal = document.getElementById('preview-total-cal');
    this.previewItemsList = document.getElementById('preview-items-list');
    this.btnConfirmAdd = document.getElementById('btn-confirm-add');
    this.btnOpenGlobalAdd = document.getElementById('btn-open-global-add');

    // Modal Ustawień Klucza Gemini API
    this.apiKeyModal = document.getElementById('api-key-modal');
    this.apiKeyCloseBtn = document.getElementById('api-key-close-btn');
    this.inputGeminiKey = document.getElementById('input-gemini-key');
    this.btnSaveGeminiKey = document.getElementById('btn-save-gemini-key');
    this.btnClearGeminiKey = document.getElementById('btn-clear-gemini-key');
    this.inputProfileGeminiKey = document.getElementById('input-profile-gemini-key');

    // Elementy trybu Ręcznego (Szybkie kalorie)
    this.manualMealTitle = document.getElementById('manual-meal-title');
    this.manualMealKcal = document.getElementById('manual-meal-kcal');
    this.manualP = document.getElementById('manual-p');
    this.manualF = document.getElementById('manual-f');
    this.manualC = document.getElementById('manual-c');
    this.btnSaveManualMeal = document.getElementById('btn-save-manual-meal');

    // Karta Inspiracji TinyPlates
    this.tinyplatesBox = document.getElementById('tinyplates-suggestion-box');
    this.tpRecipeTitle = document.getElementById('tp-recipe-title');
    this.tpRecipeDesc = document.getElementById('tp-recipe-desc');
    this.tpRecipeCal = document.getElementById('tp-recipe-cal');
    this.tpRecipeMacros = document.getElementById('tp-recipe-macros');
    this.tpRecipeTime = document.getElementById('tp-recipe-time');
    this.tpRefreshBtn = document.getElementById('tp-refresh-btn');
    this.tpAddToMealBtn = document.getElementById('tp-add-to-meal-btn');

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
        this.voiceStatusText.textContent = 'Słucham... Mów naturalnie posiłek';
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
    // Przełącznik płci w ankiecie
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

    // Zapis ankiety
    this.profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSaveProfile();
    });

    // Edycja profilu
    this.userAvatarBtn.addEventListener('click', () => this.editUserProfile());
    this.btnEditStatus.addEventListener('click', () => this.editUserProfile());

    // Odświeżenie danych dnia
    this.btnRefreshDay.addEventListener('click', async () => {
      await this.loadAndRenderMealsForDate();
      this.showToast('Zaktualizowano bilans');
    });

    // Nawigacja datami
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

    // Główny przycisk "+ Dodaj"
    this.btnOpenGlobalAdd.addEventListener('click', () => {
      this.openMealModal('breakfast');
    });

    // Rozwijanie listy składników w karcie posiłku
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

    // Zakładki trybu wprowadzania: Inteligentny opis vs Szybkie kalorie
    this.tabModeAi.addEventListener('click', () => this.switchInputMode('ai'));
    this.tabModeManual.addEventListener('click', () => this.switchInputMode('manual'));

    // Zapis posiłku ręcznego
    this.btnSaveManualMeal.addEventListener('click', () => this.handleSaveManualMeal());

    // Zamknięcie modalu
    this.modalCloseBtn.addEventListener('click', () => this.closeMealModal());
    this.mealModal.addEventListener('click', (e) => {
      if (e.target === this.mealModal) this.closeMealModal();
    });

    // Dyktafon
    this.voiceRecordBtn.addEventListener('click', () => {
      this.voiceDictation.toggle();
    });

    // Przeliczenie z OpenFoodFacts
    this.btnParseAndAdd.addEventListener('click', () => this.handleParseFood());

    // Zatwierdzenie składników z podglądu
    this.btnConfirmAdd.addEventListener('click', () => this.handleConfirmAdd());

    // Obsługa TinyPlates (dodanie propozycji i losowanie innej)
    this.tpAddToMealBtn.addEventListener('click', () => this.handleAddTinyPlatesToMeal());
    this.tpRefreshBtn.addEventListener('click', () => this.handleRefreshTinyPlates());

    // Obsługa Aparatu / Zdjęć AI
    this.cameraScanBtn.addEventListener('click', () => this.handleCameraScanClick());
    this.cameraFileInput.addEventListener('change', (e) => this.handlePhotoSelected(e));
    this.aiPhotoCancelBtn.addEventListener('click', () => this.cancelPhotoScan());

    // Obsługa Modalu Klucza Gemini API
    this.apiKeyCloseBtn.addEventListener('click', () => this.closeApiKeyModal());
    this.btnSaveGeminiKey.addEventListener('click', () => this.saveApiKeyFromModal());
    this.btnClearGeminiKey.addEventListener('click', () => this.clearApiKey());
    this.apiKeyModal.addEventListener('click', (e) => {
      if (e.target === this.apiKeyModal) this.closeApiKeyModal();
    });
  }

  switchInputMode(mode) {
    this.activeInputMode = mode;
    if (mode === 'ai') {
      this.tabModeAi.classList.add('active');
      this.tabModeManual.classList.remove('active');
      this.sectionModeAi.style.display = 'flex';
      this.sectionModeManual.style.display = 'none';
    } else {
      this.tabModeManual.classList.add('active');
      this.tabModeAi.classList.remove('active');
      this.sectionModeAi.style.display = 'none';
      this.sectionModeManual.style.display = 'flex';
      setTimeout(() => this.manualMealKcal.focus(), 150);
    }
  }

  async handleSaveManualMeal() {
    const title = this.manualMealTitle.value.trim() || 'Posiłek';
    const kcal = parseFloat(this.manualMealKcal.value);

    if (isNaN(kcal) || kcal <= 0) {
      alert('Podaj prawidłową liczbę kalorii (kcal).');
      this.manualMealKcal.focus();
      return;
    }

    let p = parseFloat(this.manualP.value) || 0;
    let f = parseFloat(this.manualF.value) || 0;
    let c = parseFloat(this.manualC.value) || 0;

    // Jeśli użytkownik podał tylko kalorie, oszacujmy standardowy zrównoważony profil
    if (p === 0 && f === 0 && c === 0) {
      p = parseFloat(((kcal * 0.25) / 4).toFixed(1));
      f = parseFloat(((kcal * 0.25) / 9).toFixed(1));
      c = parseFloat(((kcal * 0.50) / 4).toFixed(1));
    }

    const mealRecord = {
      userId: this.user.id,
      date: this.selectedDate,
      mealKey: this.activeMealKey,
      rawTitle: title,
      items: [
        {
          name: title,
          weightG: 100,
          unitDesc: '1 porcja',
          kcal: Math.round(kcal),
          protein: p,
          fat: f,
          carbs: c,
          source: 'Wpis ręczny'
        }
      ],
      totalKcal: Math.round(kcal),
      totalP: p,
      totalF: f,
      totalC: c
    };

    await db.saveMealItem(mealRecord);
    this.closeMealModal();
    await this.loadAndRenderMealsForDate();
    this.showToast(`Dodano: ${title} (${Math.round(kcal)} kcal)`);
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

    await db.saveUser(profile);
    this.user = profile;
    this.targets = targets;

    if (this.inputProfileGeminiKey && this.inputProfileGeminiKey.value.trim()) {
      await db.saveSetting('gemini_api_key', this.inputProfileGeminiKey.value.trim());
    }

    this.showDashboard();
    await this.loadAndRenderMealsForDate();
    this.showToast(`Witaj, ${name}! Twoje dane zostały zapamiętane.`);
  }

  async editUserProfile() {
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

      const currentKey = await db.getSetting('gemini_api_key');
      if (this.inputProfileGeminiKey) {
        this.inputProfileGeminiKey.value = currentKey || '';
      }

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

  async loadAndRenderMealsForDate() {
    if (!this.user) return;
    this.mealsForSelectedDate = await db.getMealsByDate(this.user.id, this.selectedDate);
    await this.renderDashboard();
  }

  async renderDashboard() {
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

    const circumference = 232;
    const percentRatio = totalKcal > 0 ? (totalKcal / targetKcal) : 0;
    const percentInt = Math.round(percentRatio * 100);
    this.dashCirclePercent.innerHTML = `${percentInt}<span>%</span>`;

    const strokeDash = Math.max(0, circumference - (Math.min(1.5, percentRatio) * circumference));
    this.dashCircleProgress.style.strokeDashoffset = strokeDash;

    const remainingKcal = targetKcal - totalKcal;
    if (totalKcal >= targetKcal) {
      this.dashBottomLabel.textContent = 'Powyżej celu spożycia';
      this.dashBottomVal.textContent = `${totalKcal - targetKcal} kcal`;
    } else {
      this.dashBottomLabel.textContent = 'Pozostało do celu';
      this.dashBottomVal.textContent = `${remainingKcal} kcal`;
    }

    // 2. Karta Makro
    this.dashPVal.innerHTML = `≥ ${totalP.toFixed(1)} <span>g</span>`;
    this.dashPTargetSub.textContent = `cel: ${this.targets.protein.min}-${this.targets.protein.max}g`;

    this.dashCVal.innerHTML = `≥ ${totalC.toFixed(1)} <span>g</span>`;
    this.dashCTargetSub.textContent = `cel: ${this.targets.carbs.min}-${this.targets.carbs.max}g`;

    this.dashFVal.innerHTML = `≥ ${totalF.toFixed(1)} <span>g</span>`;
    this.dashFTargetSub.textContent = `cel: ${this.targets.fat.min}-${this.targets.fat.max}g`;

    // 3. Sekcje posiłków
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

    // 4. Subtelna inspiracja TinyPlates (np. gdy na kolację pozostaje ~500 kcal)
    await this.updateTinyPlatesSuggestion(remainingKcal);
  }

  async updateTinyPlatesSuggestion(remainingKcal) {
    if (!this.tinyplatesBox) return;

    // Pokazuj propozycję, gdy pozostało od 150 do 950 kcal
    if (remainingKcal >= 150) {
      const recipe = await getTinyPlatesSuggestion(remainingKcal, 'dinner');
      this.currentTinyPlate = recipe;

      this.tpRecipeTitle.textContent = recipe.title;
      this.tpRecipeDesc.textContent = recipe.ingredientsSummary;
      this.tpRecipeCal.textContent = `${recipe.kcal} kcal`;
      this.tpRecipeMacros.textContent = `B: ${recipe.protein}g • T: ${recipe.fat}g • W: ${recipe.carbs}g`;
      this.tpRecipeTime.textContent = `⏱ ${recipe.timeMin} min`;

      this.tinyplatesBox.style.display = 'flex';
    } else {
      this.tinyplatesBox.style.display = 'none';
    }
  }

  handleRefreshTinyPlates() {
    const remainingKcal = this.targets ? (this.targets.calories.target - parseFloat(this.dashCalConsumed.textContent)) : 500;
    const currentId = this.currentTinyPlate?.id || null;
    const nextRecipe = findClosestRecipe(remainingKcal, 'dinner', currentId);
    this.currentTinyPlate = nextRecipe;

    this.tpRecipeTitle.textContent = nextRecipe.title;
    this.tpRecipeDesc.textContent = nextRecipe.ingredientsSummary;
    this.tpRecipeCal.textContent = `${nextRecipe.kcal} kcal`;
    this.tpRecipeMacros.textContent = `B: ${nextRecipe.protein}g • T: ${nextRecipe.fat}g • W: ${nextRecipe.carbs}g`;
    this.tpRecipeTime.textContent = `⏱ ${nextRecipe.timeMin} min`;
    this.showToast('Nowa inspiracja TinyPlates');
  }

  async handleAddTinyPlatesToMeal() {
    if (!this.currentTinyPlate) return;

    const r = this.currentTinyPlate;
    const mealRecord = {
      userId: this.user.id,
      date: this.selectedDate,
      mealKey: 'dinner', // Dodaj do kolacji
      rawTitle: r.title,
      items: [
        {
          name: r.title,
          weightG: 250,
          unitDesc: '1 porcja',
          kcal: r.kcal,
          protein: r.protein,
          fat: r.fat,
          carbs: r.carbs,
          source: r.source || 'TinyPlates API'
        }
      ],
      totalKcal: r.kcal,
      totalP: r.protein,
      totalF: r.fat,
      totalC: r.carbs
    };

    await db.saveMealItem(mealRecord);
    await this.loadAndRenderMealsForDate();
    this.showToast(`Dodano "${r.title}" do Kolacji!`);
  }

  // Obsługa aparatu i zdjęć posiłków AI
  handleCameraScanClick() {
    this.cameraFileInput.value = '';
    this.cameraFileInput.click();
  }

  async handlePhotoSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      this.aiPhotoPreviewWrap.style.display = 'flex';
      this.aiPhotoStatus.textContent = 'Kompresuję zdjęcie na telefonie...';
      this.btnParseAndAdd.disabled = true;

      // Kompresja w locie (z ~10MB do ~100KB)
      const compressed = await compressImage(file);
      this.aiPhotoThumb.src = compressed.previewUrl;

      this.aiPhotoStatus.textContent = 'Gemini AI analizuje potrawę i kalorie... 🔍';

      // Automatycznie korzysta z klucza zdefiniowanego w pliku .env
      const result = await analyzeFoodImage(compressed.base64, compressed.mimeType);

      this.aiPhotoStatus.textContent = `Rozpoznano: ${result.dishTitle} (${result.totalKcal} kcal) ✨`;
      this.mealTextInput.value = result.dishTitle;
      this.pendingParsedItems = result.items;
      this.renderParsedPreview(result.items);
      this.showToast(`AI rozpoznało: ${result.dishTitle}!`);
    } catch (err) {
      console.error('Błąd analizy zdjęcia:', err);
      this.aiPhotoStatus.textContent = `Błąd: ${err.message}`;
      alert(`Problem z analizą zdjęcia:\n${err.message}\n\nUpewnij się, że serwer jest uruchomiony z plikiem .env.`);
    } finally {
      this.btnParseAndAdd.disabled = false;
    }
  }

  cancelPhotoScan() {
    if (this.aiPhotoPreviewWrap) {
      this.aiPhotoPreviewWrap.style.display = 'none';
    }
    if (this.cameraFileInput) {
      this.cameraFileInput.value = '';
    }
  }

  async openApiKeyModal() {
    const currentKey = await db.getSetting('gemini_api_key') || '';
    if (this.inputGeminiKey) {
      this.inputGeminiKey.value = currentKey;
    }
    if (this.apiKeyModal) {
      this.apiKeyModal.classList.add('active');
    }
  }

  closeApiKeyModal() {
    if (this.apiKeyModal) {
      this.apiKeyModal.classList.remove('active');
    }
  }

  async saveApiKeyFromModal() {
    const key = this.inputGeminiKey.value.trim();
    if (!key) {
      alert('Wklej prawidłowy klucz API Google Gemini (np. zaczynający się od AIzaSy...)');
      return;
    }
    await db.saveSetting('gemini_api_key', key);
    if (this.inputProfileGeminiKey) {
      this.inputProfileGeminiKey.value = key;
    }
    this.closeApiKeyModal();
    this.showToast('Klucz Gemini API zapisany! Uruchamiam aparat...');
    setTimeout(() => {
      this.cameraFileInput.value = '';
      this.cameraFileInput.click();
    }, 400);
  }

  async clearApiKey() {
    if (confirm('Czy na pewno chcesz usunąć zapisany klucz Gemini API?')) {
      await db.saveSetting('gemini_api_key', null);
      if (this.inputGeminiKey) this.inputGeminiKey.value = '';
      if (this.inputProfileGeminiKey) this.inputProfileGeminiKey.value = '';
      this.closeApiKeyModal();
      this.showToast('Klucz API usunięty');
    }
  }

  // Modal posiłków
  openMealModal(mealKey = 'breakfast') {
    this.activeMealKey = mealKey;
    this.selectModalMeal(mealKey);
    this.switchInputMode('ai');
    this.cancelPhotoScan();

    this.mealTextInput.value = '';
    this.manualMealTitle.value = '';
    this.manualMealKcal.value = '';
    this.manualP.value = '';
    this.manualF.value = '';
    this.manualC.value = '';

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
      this.btnParseAndAdd.innerHTML = `<span>Przelicz kalorie (OpenFoodFacts)</span> <span>⚡</span>`;
    }
  }

  renderParsedPreview(items) {
    if (!items || items.length === 0) {
      this.previewBox.style.display = 'flex';
      this.previewItemsList.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding: 6px;">Nie rozpoznano konkretnych produktów spożywczych. Sprawdź prosty schemat podpowiedzi powyżej.</div>`;
      this.previewTotalCal.textContent = '0 kcal';
      this.btnConfirmAdd.style.display = 'none';
      return;
    }

    this.btnConfirmAdd.style.display = 'flex';
    this.previewBox.style.display = 'flex';

    const recipeTitle = items[0]?.recipeTitle || this.mealTextInput.value.trim();
    if (this.previewTitleBadge) {
      this.previewTitleBadge.textContent = recipeTitle ? `Danie: ${recipeTitle}` : 'Rozpoznane pozycje';
    }

    const totalKcal = items.reduce((sum, item) => sum + item.kcal, 0);
    this.previewTotalCal.textContent = `Razem: ${totalKcal} kcal`;

    this.previewItemsList.innerHTML = items.map((item, idx) => `
      <div class="single-food-item">
        <div style="flex: 1; min-width: 0;">
          <div class="food-title">${item.name}</div>
          <div class="food-macros-line">${item.source} • B: ${item.protein}g | T: ${item.fat}g | W: ${item.carbs}g</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="inline-weight-edit">
            <input type="number" class="input-weight-small" value="${item.weightG}" data-weight-idx="${idx}" min="5" max="2500" step="5" title="Zmień gramaturę">
            <span style="font-size: 10.5px; color: var(--text-muted);">g</span>
          </div>
          <span style="font-weight: 800; color: var(--green-dark); min-width: 50px; text-align: right;">${item.kcal} kcal</span>
          <button type="button" class="food-del-btn" data-preview-idx="${idx}" title="Usuń">&times;</button>
        </div>
      </div>
    `).join('');

    // Zmiana wagi składnika w locie
    this.previewItemsList.querySelectorAll('.input-weight-small').forEach(input => {
      input.addEventListener('change', () => {
        const idx = Number(input.dataset.weightIdx);
        const newWeight = parseFloat(input.value) || 50;
        const it = this.pendingParsedItems[idx];
        if (it) {
          const ratio = newWeight / it.weightG;
          it.weightG = newWeight;
          it.unitDesc = `${newWeight}g`;
          it.kcal = Math.round(it.kcal * ratio);
          it.protein = parseFloat((it.protein * ratio).toFixed(1));
          it.fat = parseFloat((it.fat * ratio).toFixed(1));
          it.carbs = parseFloat((it.carbs * ratio).toFixed(1));
          this.renderParsedPreview(this.pendingParsedItems);
        }
      });
    });

    // Usuwanie składnika z podglądu
    this.previewItemsList.querySelectorAll('.food-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.previewIdx);
        this.pendingParsedItems.splice(idx, 1);
        this.renderParsedPreview(this.pendingParsedItems);
      });
    });
  }

  async handleConfirmAdd() {
    if (!this.pendingParsedItems || this.pendingParsedItems.length === 0) return;

    const rawTitle = this.pendingParsedItems[0]?.recipeTitle || this.mealTextInput.value.trim() || 'Posiłek';
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

    await db.saveMealItem(mealRecord);
    this.closeMealModal();
    await this.loadAndRenderMealsForDate();
    this.showToast(`Dodano: ${rawTitle} (${totalKcal} kcal)`);
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
  window.db = db;
});
