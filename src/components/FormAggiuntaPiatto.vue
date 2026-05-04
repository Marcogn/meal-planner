<script setup lang="ts">
import { ref, computed } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import type { DayOfWeek, MealType, Dish } from '../domain/types';
import { addDishToSlot, removeDishFromSlot } from '../storage/weeks';
import { useElementiStore } from '../stores/elementiStore';
import { useSettimanaStore } from '../stores/settimanaStore';

const MEAL_LABELS: Record<MealType, string> = {
  colazione: 'Colazione',
  merenda_mattina: 'Merenda (mat.)',
  pranzo: 'Pranzo',
  merenda_pomeriggio: 'Merenda (pom.)',
  cena: 'Cena',
};

const props = withDefaults(
  defineProps<{
    day: DayOfWeek;
    meal: MealType;
    /** Se presente, la form è in modalità modifica */
    existingDish?: Dish;
  }>(),
  { existingDish: undefined },
);

const emit = defineEmits<{ close: [] }>();

const elementiStore = useElementiStore();
const settimanaStore = useSettimanaStore();

const dishName = ref(props.existingDish?.name ?? '');
// Copia per non mutare l'array originale; usiamo Set per toggle O(1)
const selectedIds = ref<Set<string>>(new Set(props.existingDish?.elementIds ?? []));
const searchQuery = ref('');
const errorMsg = ref('');
const saving = ref(false);

const isEditMode = computed(() => props.existingDish !== undefined);
const title = computed(() => (isEditMode.value ? 'Modifica piatto' : 'Aggiungi piatto'));

const filteredElements = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return elementiStore.elements;
  return elementiStore.elements.filter((e) => e.name.toLowerCase().includes(q));
});

function toggleElement(id: string) {
  // Creiamo un nuovo Set per mantenere la reattività
  const next = new Set(selectedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedIds.value = next;
}

async function save() {
  const name = dishName.value.trim();
  if (!name) {
    errorMsg.value = 'Il nome del piatto non può essere vuoto.';
    return;
  }
  errorMsg.value = '';
  saving.value = true;
  try {
    const dish: Dish = {
      id: isEditMode.value ? props.existingDish!.id : uuidv4(),
      name,
      elementIds: [...selectedIds.value],
    };
    if (isEditMode.value) {
      // Rimuovi il piatto precedente, poi inserisci quello aggiornato
      await removeDishFromSlot(
        settimanaStore.currentWeekId,
        props.day,
        props.meal,
        props.existingDish!.id,
      );
    }
    await addDishToSlot(settimanaStore.currentWeekId, props.day, props.meal, dish);
    await settimanaStore.refresh();
    emit('close');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="overlay" role="dialog" :aria-label="title" aria-modal="true" @click.self="emit('close')" @keydown.esc="emit('close')">
    <div class="modal">
      <!-- Header -->
      <div class="modal-header">
        <h3 class="modal-title">{{ title }}</h3>
        <p class="modal-subtitle">{{ MEAL_LABELS[meal] }}</p>
      </div>

      <!-- Nome piatto -->
      <label class="field-label" for="fp-name">Nome piatto *</label>
      <input
        id="fp-name"
        v-model="dishName"
        class="field-input"
        type="text"
        placeholder="es. mozzarella e insalata con pane"
        autocomplete="off"
        @keydown.enter.prevent="save"
      />

      <p v-if="errorMsg" class="error-msg" role="alert">{{ errorMsg }}</p>

      <!-- Selezione Elementi -->
      <div class="elements-section">
        <p class="field-label">
          Elementi
          <span class="selected-count" :class="{ 'selected-count--active': selectedIds.size > 0 }">
            {{ selectedIds.size > 0 ? `(${selectedIds.size} selezionati)` : '' }}
          </span>
        </p>
        <input
          v-model="searchQuery"
          class="field-input search-input"
          type="search"
          placeholder="Filtra elementi…"
          aria-label="Filtra elementi"
        />
        <ul class="elements-list" role="list">
          <li
            v-for="el in filteredElements"
            :key="el.id"
            class="el-item"
          >
            <label class="el-check-label">
              <input
                type="checkbox"
                :checked="selectedIds.has(el.id)"
                @change="toggleElement(el.id)"
              />
              <span class="el-name">{{ el.name }}</span>
              <span class="el-freq">
                {{ el.maxFrequencyPerWeek === 'unlimited' ? '∞' : el.maxFrequencyPerWeek }}/sett
              </span>
            </label>
          </li>
          <li v-if="filteredElements.length === 0" class="no-results">
            Nessun elemento trovato.
          </li>
        </ul>
      </div>

      <!-- Azioni -->
      <div class="modal-actions">
        <button class="btn btn-primary" :disabled="saving" @click="save">
          {{ saving ? 'Salvataggio…' : isEditMode ? 'Salva modifiche' : 'Aggiungi' }}
        </button>
        <button class="btn" @click="emit('close')">Annulla</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Overlay ── */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.48);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

/* ── Modal ── */
.modal {
  background: #fff;
  border-radius: 8px;
  padding: 1.25rem 1.5rem 1.5rem;
  width: min(460px, 95vw);
  max-height: 90vh; /* fallback for browsers without dvh */
  max-height: 90dvh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.modal-header {
  margin-bottom: 0.25rem;
}

.modal-title {
  margin: 0 0 0.15rem;
  font-size: 1.05rem;
}

.modal-subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: #666;
}

/* ── Campi ── */
.field-label {
  font-size: 0.88rem;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.field-input {
  padding: 0.4rem 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.95rem;
  width: 100%;
}

.field-input:focus {
  outline: none;
  border-color: #4466cc;
  box-shadow: 0 0 0 2px rgba(68, 102, 204, 0.2);
}

.error-msg {
  color: #cc0000;
  font-size: 0.87rem;
  margin: 0;
}

/* ── Sezione elementi ── */
.elements-section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.selected-count {
  font-weight: 400;
  color: #888;
  font-size: 0.82rem;
}

.selected-count--active {
  color: #1a7a1a;
  font-weight: 600;
}

.search-input {
  font-size: 0.9rem;
}

.elements-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.el-item {
  border-bottom: 1px solid #f0f0f0;
}

.el-item:last-child {
  border-bottom: none;
}

.el-check-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  cursor: pointer;
  font-size: 0.9rem;
  min-height: 44px;
}

.el-check-label:hover {
  background: #f5f7ff;
}

.el-name {
  flex: 1;
}

.el-freq {
  font-size: 0.78rem;
  color: #888;
  white-space: nowrap;
}

.no-results {
  padding: 0.6rem;
  font-size: 0.88rem;
  color: #999;
  font-style: italic;
}

/* ── Azioni ── */
.modal-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.btn {
  padding: 0.45rem 0.9rem;
  font-size: 0.95rem;
  border-radius: 4px;
  cursor: pointer;
  min-height: 44px;
  border: 1px solid #999;
  background: #f5f5f5;
}

.btn:hover:not(:disabled) {
  background: #e8e8e8;
}

.btn-primary {
  background: #1a7a1a;
  color: #fff;
  border-color: #1a7a1a;
}

.btn-primary:hover:not(:disabled) {
  background: #155e15;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
