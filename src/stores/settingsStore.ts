import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Settings } from '../domain/types';
import * as repo from '../data/settingsRepository';

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ constraints: [], recencyWindowWeeks: 4 });

  async function load() {
    settings.value = await repo.getSettings();
  }

  async function save(newSettings: Settings) {
    await repo.saveSettings(newSettings);
    settings.value = { ...newSettings };
  }

  return { settings, load, save };
});
