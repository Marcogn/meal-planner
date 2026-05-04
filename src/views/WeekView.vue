<script setup lang="ts">
import { onMounted, computed, ref } from 'vue';
import { useSettimanaStore } from '../stores/settimanaStore';
import { useElementiStore } from '../stores/elementiStore';
import { weekIdToMonday, formatWeekLabel, getCurrentWeekId } from '../domain/week';
import { computeWeeklyFrequencies } from '../domain/frequency';
import { removeDishFromSlot } from '../storage/weeks';
import FormAggiuntaPiatto from '../components/FormAggiuntaPiatto.vue';
import ReminderFrequenze from '../components/ReminderFrequenze.vue';
import type { DayOfWeek, MealType, Dish } from '../domain/types';

const settimanaStore = useSettimanaStore();
const elementiStore = useElementiStore();

// ── Tutti i pasti in ordine cronologico ──
const ALL_MEALS: { type: MealType; label: string }[] = [
  { type: 'colazione', label: 'Colazione' },
  { type: 'merenda_mattina', label: 'Merenda (mat.)' },
  { type: 'pranzo', label: 'Pranzo' },
  { type: 'merenda_pomeriggio', label: 'Merenda (pom.)' },
  { type: 'cena', label: 'Cena' },
];

const OPTIONAL_TYPES = new Set<MealType>(['colazione', 'merenda_mattina', 'merenda_pomeriggio']);

const visibleMeals = computed(() =>
  settimanaStore.showOptionalMeals
    ? ALL_MEALS
    : ALL_MEALS.filter((m) => !OPTIONAL_TYPES.has(m.type)),
);

const DAYS: { day: DayOfWeek; shortLabel: string }[] = [
  { day: 1, shortLabel: 'Lun' },
  { day: 2, shortLabel: 'Mar' },
  { day: 3, shortLabel: 'Mer' },
  { day: 4, shortLabel: 'Gio' },
  { day: 5, shortLabel: 'Ven' },
  { day: 6, shortLabel: 'Sab' },
  { day: 7, shortLabel: 'Dom' },
];

// Intestazioni colonna giorno: shortLabel + data gg/mm
const dayHeaders = computed(() => {
  const monday = weekIdToMonday(settimanaStore.currentWeekId);
  return DAYS.map(({ day, shortLabel }) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + (day - 1));
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return { day, shortLabel, date: `${dd}/${mm}` };
  });
});

// T3.2 — label formattata e flag "è la settimana corrente"
const weekLabel = computed(() => formatWeekLabel(settimanaStore.currentWeekId));
const isCurrentWeek = computed(
  () => settimanaStore.currentWeekId === getCurrentWeekId(),
);

// T3.6 / T4.3 — frequenze settimanali calcolate reattivamente.
// La Map si ricalcola automaticamente ogni volta che settimanaStore.week cambia
// (cioè dopo ogni add/remove piatto che chiama settimanaStore.refresh()),
// così il pannello ReminderFrequenze si aggiorna senza alcun reload manuale.
const frequencies = computed(() => {
  if (!settimanaStore.week) return new Map();
  return computeWeeklyFrequencies(settimanaStore.week, elementiStore.elements);
});

function getChipData(elementId: string): { label: string; exceeded: boolean } {
  const el = elementiStore.elements.find((e) => e.id === elementId);
  const freq = frequencies.value.get(elementId);
  const name = el?.name ?? '(eliminato)';
  if (!freq || freq.max === 'unlimited') return { label: name, exceeded: false };
  return {
    label: `${name} (${freq.used}/${freq.max})`,
    exceeded: freq.exceeded,
  };
}

// T3.3 — piatti per slot: mappa pre-calcolata per evitare ricerche ripetute nel template
const slotsMap = computed(() => {
  const map = new Map<string, Dish[]>();
  if (!settimanaStore.week) return map;
  for (const slot of settimanaStore.week.slots) {
    map.set(`${slot.day}-${slot.meal}`, slot.dishes);
  }
  return map;
});

function getDishes(day: DayOfWeek, meal: MealType): Dish[] {
  return slotsMap.value.get(`${day}-${meal}`) ?? [];
}

// T3.5 — elimina piatto
async function deleteDish(day: DayOfWeek, meal: MealType, dishId: string) {
  await removeDishFromSlot(settimanaStore.currentWeekId, day, meal, dishId);
  await settimanaStore.refresh();
}

// T3.4 / T3.5 — form aggiunta / modifica
const showForm = ref(false);
const formDay = ref<DayOfWeek>(1);
const formMeal = ref<MealType>('pranzo');
const formExistingDish = ref<Dish | undefined>(undefined);

function openAddForm(day: DayOfWeek, meal: MealType) {
  formDay.value = day;
  formMeal.value = meal;
  formExistingDish.value = undefined;
  showForm.value = true;
}

function openEditForm(day: DayOfWeek, meal: MealType, dish: Dish) {
  formDay.value = day;
  formMeal.value = meal;
  formExistingDish.value = dish;
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
}

onMounted(async () => {
  await Promise.all([settimanaStore.loadCurrentWeek(), elementiStore.load()]);
});
</script>

<template>
  <div class="settimana-view">
    <!-- T3.2 — Navigazione settimane -->
    <div class="week-nav">
      <button
        class="nav-btn"
        aria-label="Settimana precedente"
        @click="settimanaStore.goToPrevWeek()"
      >
        &#8592;
      </button>
      <span class="week-label">{{ weekLabel }}</span>
      <button
        class="nav-btn"
        aria-label="Settimana successiva"
        @click="settimanaStore.goToNextWeek()"
      >
        &#8594;
      </button>
      <button
        v-if="!isCurrentWeek"
        class="today-btn"
        @click="settimanaStore.goToToday()"
      >
        Oggi
      </button>
    </div>

    <!-- Toggle pasti opzionali -->
    <div class="toggle-bar">
      <label class="toggle-label">
        <input
          type="checkbox"
          :checked="settimanaStore.showOptionalMeals"
          @change="
            settimanaStore.setShowOptionalMeals(
              ($event.target as HTMLInputElement).checked,
            )
          "
        />
        Mostra colazione e merende
      </label>
    </div>

    <!-- T3.3 — Griglia settimanale -->
    <div class="grid-wrapper">
      <div
        class="week-grid"
        :style="{ gridTemplateColumns: `var(--meal-col-w) repeat(7, minmax(4rem, 1fr))` }"
      >
        <!-- Riga header -->
        <div class="cell cell--corner" aria-hidden="true"></div>
        <div
          v-for="dh in dayHeaders"
          :key="dh.day"
          class="cell cell--day-header"
        >
          <span class="day-name">{{ dh.shortLabel }}</span>
          <span class="day-date">{{ dh.date }}</span>
        </div>

        <!-- Righe pasti -->
        <template v-for="meal in visibleMeals" :key="meal.type">
          <div class="cell cell--meal-label">{{ meal.label }}</div>

          <div
            v-for="dh in dayHeaders"
            :key="dh.day"
            class="cell cell--slot"
            :class="{ 'cell--slot-empty': getDishes(dh.day, meal.type).length === 0 }"
            :role="getDishes(dh.day, meal.type).length === 0 ? 'button' : undefined"
            :tabindex="getDishes(dh.day, meal.type).length === 0 ? 0 : undefined"
            :aria-label="
              getDishes(dh.day, meal.type).length === 0
                ? `Aggiungi piatto: ${meal.label} ${dh.shortLabel} ${dh.date}`
                : undefined
            "
            @click="
              getDishes(dh.day, meal.type).length === 0
                ? openAddForm(dh.day, meal.type)
                : undefined
            "
            @keydown.enter="
              getDishes(dh.day, meal.type).length === 0
                ? openAddForm(dh.day, meal.type)
                : undefined
            "
          >
            <!-- Slot vuoto -->
            <span
              v-if="getDishes(dh.day, meal.type).length === 0"
              class="empty-hint"
              aria-hidden="true"
            >+</span>

            <!-- Slot occupato: uno o più piatti -->
            <template v-else>
              <div
                v-for="dish in getDishes(dh.day, meal.type)"
                :key="dish.id"
                class="dish-card"
              >
                <!-- Nome piatto + azioni -->
                <div class="dish-header">
                  <span class="dish-name">{{ dish.name }}</span>
                  <div class="dish-actions">
                    <button
                      class="action-btn"
                      title="Modifica piatto"
                      aria-label="Modifica piatto"
                      @click.stop="openEditForm(dh.day, meal.type, dish)"
                    >
                      <span aria-hidden="true">✏️</span>
                    </button>
                    <button
                      class="action-btn action-btn--danger"
                      title="Elimina piatto"
                      aria-label="Elimina piatto"
                      @click.stop="deleteDish(dh.day, meal.type, dish.id)"
                    >
                      <span aria-hidden="true">🗑️</span>
                    </button>
                  </div>
                </div>

                <!-- T3.6 — Chip elementi -->
                <div v-if="dish.elementIds.length > 0" class="chips">
                  <span
                    v-for="elId in dish.elementIds"
                    :key="elId"
                    class="chip"
                    :class="{ 'chip--exceeded': getChipData(elId).exceeded }"
                  >
                    {{ getChipData(elId).label }}
                  </span>
                </div>
              </div>

              <!-- Pulsante aggiungi ulteriore piatto -->
              <button
                class="add-more-btn"
                :aria-label="`Aggiungi altro piatto: ${meal.label} ${dh.shortLabel} ${dh.date}`"
                @click.stop="openAddForm(dh.day, meal.type)"
              >
                +
              </button>
            </template>
          </div>
        </template>
      </div>
    </div>

    <!-- T3.4 / T3.5 — Form modale aggiunta/modifica piatto -->
    <FormAggiuntaPiatto
      v-if="showForm"
      :day="formDay"
      :meal="formMeal"
      :existing-dish="formExistingDish"
      @close="closeForm"
    />

    <!-- T4.1 — Pannello reminder frequenze -->
    <ReminderFrequenze
      :frequencies="frequencies"
      :elements="elementiStore.elements"
    />
  </div>
</template>

<style scoped>
.settimana-view {
  --meal-col-w: 6.5rem;
  padding: 0.5rem;
}

/* ── T3.2 Navigazione ── */
.week-nav {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.nav-btn {
  min-width: 44px;
  min-height: 44px;
  font-size: 1.1rem;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.week-label {
  font-weight: 600;
  font-size: 0.95rem;
  flex: 1;
  white-space: nowrap;
}

.today-btn {
  font-size: 0.85rem;
  padding: 0.3rem 0.7rem;
  min-height: 44px;
  background: #eef2ff;
  border-color: #99aadd;
  color: #2244aa;
  border-radius: 4px;
}

.today-btn:hover {
  background: #dde6ff;
}

/* ── Toggle pasti opzionali ── */
.toggle-bar {
  margin-bottom: 0.75rem;
}

.toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  font-size: 0.9rem;
  user-select: none;
}

/* ── Griglia ── */
.grid-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.week-grid {
  display: grid;
  gap: 2px;
  min-width: 32rem;
}

.cell {
  padding: 4px 3px;
  font-size: 0.82rem;
}

.cell--corner {
  /* spazio top-left */
}

.cell--day-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  font-weight: 700;
  text-align: center;
  padding: 4px 2px;
}

.day-name {
  font-size: 0.82rem;
}

.day-date {
  font-size: 0.72rem;
  color: #666;
}

.cell--meal-label {
  font-weight: 600;
  font-size: 0.8rem;
  color: #444;
  display: flex;
  align-items: center;
  padding-right: 0.25rem;
}

/* ── Slot ── */
.cell--slot {
  border: 1px solid #ddd;
  border-radius: 4px;
  min-height: 52px;
  background: #fafafa;
  word-break: break-word;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 3px;
}

/* Slot vuoto: centrato + cursore pointer */
.cell--slot-empty {
  cursor: pointer;
  align-items: center;
  justify-content: center;
}

.cell--slot-empty:hover,
.cell--slot-empty:focus-visible {
  background: #eef2ff;
  border-color: #99aadd;
  outline: none;
}

.empty-hint {
  color: #bbb;
  font-size: 1.3rem;
  line-height: 1;
}

/* ── T3.3 Piatto card ── */
.dish-card {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 4px 5px;
  margin-bottom: 3px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.dish-header {
  display: flex;
  align-items: flex-start;
  gap: 2px;
}

.dish-name {
  font-weight: 600;
  flex: 1;
  font-size: 0.8rem;
  line-height: 1.3;
}

.dish-actions {
  display: flex;
  gap: 1px;
  flex-shrink: 0;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 2px;
  min-width: 24px;
  min-height: 24px;
  border-radius: 3px;
  line-height: 1;
}

.action-btn:hover {
  background: #f0f0f0;
}

.action-btn--danger:hover {
  background: #fde8e8;
}

/* ── T3.6 Chip elementi ── */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.chip {
  display: inline-block;
  background: #e8edf8;
  color: #2244aa;
  border-radius: 10px;
  padding: 1px 6px;
  font-size: 0.7rem;
  line-height: 1.5;
  white-space: nowrap;
}

.chip--exceeded {
  background: #fde8e8;
  color: #cc0000;
  font-weight: 600;
}

/* ── Pulsante "aggiungi altro piatto" ── */
.add-more-btn {
  align-self: center;
  background: none;
  border: 1px dashed #bbb;
  color: #999;
  border-radius: 3px;
  font-size: 0.85rem;
  padding: 2px 8px;
  min-height: 28px;
  cursor: pointer;
  width: 100%;
  margin-top: 2px;
}

.add-more-btn:hover {
  background: #eef2ff;
  border-color: #99aadd;
  color: #2244aa;
}
</style>
