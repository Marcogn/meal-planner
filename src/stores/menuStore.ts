import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Meal, WeeklyMenu } from '../domain/types';
import * as repo from '../data/menuRepository';

export const useMenuStore = defineStore('menu', () => {
  const currentMenu = ref<WeeklyMenu>({ isoWeek: '', meals: [] });
  const history = ref<WeeklyMenu[]>([]);

  async function loadWeek(isoWeek: string) {
    currentMenu.value = await repo.getMenuForWeek(isoWeek);
  }

  async function loadHistory() {
    history.value = await repo.getAllMenus();
  }

  async function addMeal(meal: Meal, isoWeek: string) {
    await repo.saveMeal(meal);
    await loadWeek(isoWeek);
    await loadHistory();
  }

  async function removeMeal(id: string, isoWeek: string) {
    await repo.deleteMeal(id);
    await loadWeek(isoWeek);
    await loadHistory();
  }

  async function bulkPutMenus(menus: WeeklyMenu[]) {
    await repo.bulkPutMenus(menus);
    await loadHistory();
  }

  return { currentMenu, history, loadWeek, loadHistory, addMeal, removeMeal, bulkPutMenus };
});
