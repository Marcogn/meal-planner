import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Week, MealType, DayOfWeek, Dish } from '../domain/types';
import { getCurrentWeekId, nextWeek, prevWeek, weekIdToMonday } from '../domain/week';
import { getOrCreateWeek } from '../storage/weeks';

const LS_KEY = 'menuPlanner.showOptionalMeals';

export const useSettimanaStore = defineStore('settimana', () => {
  const currentWeekId = ref<string>(getCurrentWeekId());
  const week = ref<Week | null>(null);
  const loading = ref(false);

  // Persisted in localStorage; default true (show optional meals by default)
  const showOptionalMeals = ref<boolean>(localStorage.getItem(LS_KEY) !== 'false');

  function setShowOptionalMeals(value: boolean): void {
    showOptionalMeals.value = value;
    localStorage.setItem(LS_KEY, String(value));
  }

  const todayWeekId = computed(() => getCurrentWeekId());

  async function loadCurrentWeek(): Promise<void> {
    loading.value = true;
    try {
      week.value = await getOrCreateWeek(currentWeekId.value);
    } finally {
      loading.value = false;
    }
  }

  async function navigateTo(weekId: string): Promise<void> {
    currentWeekId.value = weekId;
    await loadCurrentWeek();
  }

  async function goToNextWeek(): Promise<void> {
    await navigateTo(nextWeek(currentWeekId.value));
  }

  async function goToPrevWeek(): Promise<void> {
    await navigateTo(prevWeek(currentWeekId.value));
  }

  async function goToToday(): Promise<void> {
    await navigateTo(getCurrentWeekId());
  }

  function getDishesForSlot(day: DayOfWeek, meal: MealType): Dish[] {
    if (!week.value) return [];
    const slot = week.value.slots.find((s) => s.day === day && s.meal === meal);
    return slot?.dishes ?? [];
  }

  /** Aggiorna il ref `week` con i dati freschi da DB (usato dopo add/remove piatto). */
  async function refresh(): Promise<void> {
    week.value = await getOrCreateWeek(currentWeekId.value);
  }

  // Convenience: Monday Date for current week
  const currentMonday = computed(() => weekIdToMonday(currentWeekId.value));

  return {
    currentWeekId,
    week,
    loading,
    showOptionalMeals,
    todayWeekId,
    currentMonday,
    setShowOptionalMeals,
    loadCurrentWeek,
    goToNextWeek,
    goToPrevWeek,
    goToToday,
    getDishesForSlot,
    refresh,
  };
});
