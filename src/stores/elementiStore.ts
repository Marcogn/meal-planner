import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Element, FrequencyLimit, ID } from '../domain/types';
import {
  getAllElements,
  createElement,
  updateElement,
  deleteElement,
  ElementValidationError,
} from '../storage/elements';
import { countDishesUsingElement, removeElementFromAllWeeks } from '../storage/weeks';

export { ElementValidationError };

export const useElementiStore = defineStore('elementi', () => {
  const elements = ref<Element[]>([]);
  const loading = ref(false);

  async function load(): Promise<void> {
    loading.value = true;
    try {
      elements.value = await getAllElements();
    } finally {
      loading.value = false;
    }
  }

  async function create(data: {
    name: string;
    maxFrequencyPerWeek: FrequencyLimit;
  }): Promise<void> {
    await createElement(data);
    await load();
  }

  async function update(
    id: ID,
    data: Partial<Pick<Element, 'name' | 'maxFrequencyPerWeek'>>,
  ): Promise<void> {
    await updateElement(id, data);
    await load();
  }

  async function countUsage(id: ID): Promise<number> {
    return countDishesUsingElement(id);
  }

  async function remove(id: ID): Promise<void> {
    await removeElementFromAllWeeks(id);
    await deleteElement(id);
    await load();
  }

  return { elements, loading, load, create, update, remove, countUsage };
});
