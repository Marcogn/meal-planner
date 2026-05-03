<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useMenuStore } from '../stores/menuStore';
import { useDishesStore } from '../stores/dishesStore';
import { useSettingsStore } from '../stores/settingsStore';
import { rankSuggestions } from '../domain/ranker';
import type { Meal, MealSlot, ProteinCategory } from '../domain/types';
import { v4 as uuidv4 } from 'uuid';

function getIsoWeekFromDate(d: Date): string {
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = d.getTime() - startOfWeek1.getTime();
  const weekNum = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function isoWeekToDates(isoWeek: string): string[] {
  const [yearStr, weekStr] = isoWeek.split('-W');
  const year = Number(yearStr);
  const week = Number(weekStr);
  const jan4 = new Date(year, 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const weekStart = new Date(startOfWeek1);
  weekStart.setDate(startOfWeek1.getDate() + (week - 1) * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function addWeeks(isoWeek: string, delta: number): string {
  const dates = isoWeekToDates(isoWeek);
  const base = new Date(dates[0]);
  base.setDate(base.getDate() + delta * 7);
  return getIsoWeekFromDate(base);
}

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const SLOTS: MealSlot[] = ['PRANZO', 'CENA'];

const menuStore = useMenuStore();
const dishesStore = useDishesStore();
const settingsStore = useSettingsStore();

const isoWeek = ref(getIsoWeekFromDate(new Date()));
const dates = computed(() => isoWeekToDates(isoWeek.value));

const showModal = ref(false);
const selectedDate = ref('');
const selectedSlot = ref<MealSlot>('PRANZO');
const confirmOverwrite = ref(false);
const searchQuery = ref('');

onMounted(async () => {
  await Promise.all([
    menuStore.loadWeek(isoWeek.value),
    menuStore.loadHistory(),
    dishesStore.load(),
    settingsStore.load(),
  ]);
});

watch(isoWeek, async (week) => {
  await menuStore.loadWeek(week);
});

function getMeal(date: string, slot: MealSlot): Meal | undefined {
  return menuStore.currentMenu.meals.find((m) => m.date === date && m.slot === slot);
}

function getDishName(dishId: string): string {
  return dishesStore.dishes.find((d) => d.id === dishId)?.name ?? '—';
}

function openModal(date: string, slot: MealSlot) {
  selectedDate.value = date;
  selectedSlot.value = slot;
  confirmOverwrite.value = false;
  searchQuery.value = '';
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
}

const ranked = computed(() => {
  if (!showModal.value) return [];
  const tempMenu = {
    ...menuStore.currentMenu,
    meals: menuStore.currentMenu.meals.filter(
      (m) => !(m.date === selectedDate.value && m.slot === selectedSlot.value)
    ),
  };
  const history = menuStore.history.filter((h) => h.isoWeek !== isoWeek.value);
  return rankSuggestions(dishesStore.dishes, tempMenu, history, settingsStore.settings);
});

const filteredRanked = computed(() => {
  const q = searchQuery.value.toLowerCase();
  if (!q) return ranked.value;
  return ranked.value.filter((sd) => sd.dish.name.toLowerCase().includes(q));
});

async function selectDish(dishId: string) {
  const existing = getMeal(selectedDate.value, selectedSlot.value);
  if (existing && !confirmOverwrite.value) {
    confirmOverwrite.value = true;
    return;
  }
  if (existing) {
    await menuStore.removeMeal(existing.id, isoWeek.value);
  }
  const meal: Meal = {
    id: uuidv4(),
    dishId,
    date: selectedDate.value,
    slot: selectedSlot.value,
  };
  await menuStore.addMeal(meal, isoWeek.value);
  closeModal();
}

async function removeMealFromSlot(date: string, slot: MealSlot) {
  const meal = getMeal(date, slot);
  if (meal) await menuStore.removeMeal(meal.id, isoWeek.value);
}

function getCategoryCount(category: ProteinCategory): number {
  return menuStore.currentMenu.meals.flatMap(
    (m) => dishesStore.dishes.find((d) => d.id === m.dishId)?.proteinCategories ?? []
  ).filter((cat) => cat === category).length;
}

function constraintStatus(
  category: ProteinCategory,
  min: number | undefined,
  max: number | undefined
): { text: string; cls: string } {
  const count = getCategoryCount(category);
  const filled = menuStore.currentMenu.meals.length;
  const totalSlots = 14;

  if (max !== undefined && count > max) {
    return { text: `${category}: ${count}/${max} — TROPPI`, cls: 'status-error' };
  }
  if (min !== undefined && count >= min) {
    return { text: `${category}: ${count}/${min} — OK`, cls: 'status-ok' };
  }
  if (min !== undefined && filled < totalSlots) {
    return { text: `${category}: ${count}/${min} — incompleta`, cls: 'status-warn' };
  }
  if (min !== undefined) {
    return { text: `${category}: ${count}/${min} — NON RAGGIUNTO`, cls: 'status-error' };
  }
  return { text: `${category}: ${count}`, cls: '' };
}
</script>

<template>
  <div>
    <div class="week-nav">
      <button @click="isoWeek = addWeeks(isoWeek, -1)">← Precedente</button>
      <strong>{{ isoWeek }}</strong>
      <button @click="isoWeek = addWeeks(isoWeek, 1)">Successiva →</button>
    </div>

    <div class="week-grid-wrapper">
      <div class="week-grid">
        <div class="grid-header-row">
          <div class="slot-label-cell"></div>
          <div v-for="(date, i) in dates" :key="date" class="day-header">
            {{ DAY_NAMES[i] }}<br /><small>{{ date.slice(5) }}</small>
          </div>
        </div>
        <div v-for="slot in SLOTS" :key="slot" class="grid-row">
          <div class="slot-label-cell">{{ slot }}</div>
          <div
            v-for="date in dates"
            :key="date"
            class="cell"
            @click="openModal(date, slot)"
          >
            <span v-if="getMeal(date, slot)">
              {{ getDishName(getMeal(date, slot)!.dishId) }}
              <button class="remove-btn" @click.stop="removeMealFromSlot(date, slot)">✕</button>
            </span>
            <span v-else class="empty-slot">+</span>
          </div>
        </div>
      </div>
    </div>

    <section
      v-if="settingsStore.settings.constraints.length > 0"
      class="status-panel"
    >
      <h3>Stato vincoli</h3>
      <ul>
        <li
          v-for="c in settingsStore.settings.constraints"
          :key="c.category"
        >
          <span
            :class="constraintStatus(c.category, c.minPerWeek, c.maxPerWeek).cls"
          >
            {{ constraintStatus(c.category, c.minPerWeek, c.maxPerWeek).text }}
          </span>
        </li>
      </ul>
    </section>

    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <h3>{{ selectedDate }} — {{ selectedSlot }}</h3>
        <input v-model="searchQuery" placeholder="Cerca piatto..." />
        <p v-if="getMeal(selectedDate, selectedSlot) && !confirmOverwrite" class="warn">
          Slot già occupato. Clicca di nuovo per sovrascrivere.
        </p>
        <ul class="dish-list">
          <li
            v-for="sd in filteredRanked"
            :key="sd.dish.id"
            @click="selectDish(sd.dish.id)"
          >
            {{ sd.dish.name }}
            <small v-if="sd.dish.proteinCategories.length">
              ({{ sd.dish.proteinCategories.join(', ') }})
            </small>
          </li>
          <li v-if="filteredRanked.length === 0">Nessun piatto disponibile.</li>
        </ul>
        <button @click="closeModal">Annulla</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.week-nav {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.week-grid-wrapper {
  overflow-x: auto;
}

.week-grid {
  min-width: 600px;
}

.grid-header-row,
.grid-row {
  display: grid;
  grid-template-columns: 60px repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 2px;
}

.day-header {
  font-weight: bold;
  font-size: 0.8rem;
  text-align: center;
  padding: 4px 2px;
}

.slot-label-cell {
  font-weight: bold;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  padding: 2px;
}

.cell {
  border: 1px solid #ccc;
  padding: 4px;
  min-height: 52px;
  cursor: pointer;
  font-size: 0.8rem;
  word-break: break-word;
}

.cell:hover {
  background: #f0f0f0;
}

.empty-slot {
  color: #aaa;
  font-size: 1.2rem;
}

.remove-btn {
  border: none;
  background: none;
  color: #cc0000;
  font-size: 0.7rem;
  padding: 0 2px;
  cursor: pointer;
}

.status-panel {
  margin-top: 1.5rem;
}

.status-panel ul {
  list-style: none;
  padding: 0;
}

.status-panel li {
  padding: 3px 0;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: #fff;
  border-radius: 8px;
  padding: 1.5rem;
  width: min(500px, 95vw);
  max-height: 80vh;
  overflow-y: auto;
}

.modal input {
  width: 100%;
  padding: 0.4rem;
  margin-bottom: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.dish-list {
  list-style: none;
  padding: 0;
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 0.75rem;
}

.dish-list li {
  padding: 7px 8px;
  cursor: pointer;
  border-bottom: 1px solid #eee;
}

.dish-list li:hover {
  background: #f5f5f5;
}

.warn {
  color: #b87a00;
  font-size: 0.9rem;
}
</style>
