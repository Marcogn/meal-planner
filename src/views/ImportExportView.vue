<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useDishesStore } from '../stores/dishesStore';
import { useMenuStore } from '../stores/menuStore';
import { useSettingsStore } from '../stores/settingsStore';
import { parseExport, SUPPORTED_SCHEMA_VERSION, type ExportData } from '../io/schemas';

const dishesStore = useDishesStore();
const menuStore = useMenuStore();
const settingsStore = useSettingsStore();

const message = ref('');
const isError = ref(false);
const overwrite = ref(false);

onMounted(async () => {
  await Promise.all([dishesStore.load(), menuStore.loadHistory(), settingsStore.load()]);
});

async function doExport() {
  const data: ExportData = {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    dishes: dishesStore.dishes,
    menus: menuStore.history,
    settings: settingsStore.settings,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `menuplanner-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function doImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const raw = JSON.parse(text) as unknown;
    const data = parseExport(raw);

    if (overwrite.value) {
      await dishesStore.bulkPut(data.dishes);
      await menuStore.bulkPutMenus(data.menus);
      await settingsStore.save(data.settings);
    } else {
      const existingDishIds = new Set(dishesStore.dishes.map((d) => d.id));
      const newDishes = data.dishes.filter((d) => !existingDishIds.has(d.id));
      if (newDishes.length) await dishesStore.bulkPut(newDishes);

      const existingMealIds = new Set(
        menuStore.history.flatMap((m) => m.meals.map((ml) => ml.id))
      );
      const filteredMenus = data.menus.map((menu) => ({
        ...menu,
        meals: menu.meals.filter((ml) => !existingMealIds.has(ml.id)),
      }));
      const menusWithNewMeals = filteredMenus.filter((m) => m.meals.length > 0);
      if (menusWithNewMeals.length) await menuStore.bulkPutMenus(menusWithNewMeals);
    }

    message.value = `Import completato: ${data.dishes.length} piatti, ${data.menus.length} menù.`;
    isError.value = false;
  } catch (e: unknown) {
    message.value = `Errore import: ${e instanceof Error ? e.message : String(e)}`;
    isError.value = true;
  }
  (event.target as HTMLInputElement).value = '';
}
</script>

<template>
  <div>
    <h2>Import / Export</h2>

    <section>
      <h3>Export</h3>
      <p>Scarica tutti i dati (piatti, menù, impostazioni) come file JSON.</p>
      <button @click="doExport">Scarica backup JSON</button>
    </section>

    <section>
      <h3>Import</h3>
      <label class="checkbox-label">
        <input type="checkbox" v-model="overwrite" />
        Sovrascrivi elementi in conflitto (stessa id)
      </label>
      <br />
      <input type="file" accept=".json,application/json" @change="doImport" />
    </section>

    <p v-if="message" :class="isError ? 'status-error' : 'status-ok'">{{ message }}</p>
  </div>
</template>

<style scoped>
section {
  margin-bottom: 1.5rem;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 0.5rem;
}
</style>
