import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Dish } from '../domain/types';
import * as repo from '../data/dishRepository';

export const useDishesStore = defineStore('dishes', () => {
  const dishes = ref<Dish[]>([]);

  async function load() {
    dishes.value = await repo.getAllDishes();
  }

  async function save(dish: Dish) {
    await repo.saveDish(dish);
    await load();
  }

  async function remove(id: string) {
    await repo.deleteDish(id);
    await load();
  }

  async function bulkPut(newDishes: Dish[]) {
    await repo.bulkPutDishes(newDishes);
    await load();
  }

  return { dishes, load, save, remove, bulkPut };
});
