import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Element, FrequencyLimit } from '../domain/types';
import {
  getAllElements,
  createElement,
  ElementValidationError,
} from '../storage/elements';

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

  return { elements, loading, load, create };
});
