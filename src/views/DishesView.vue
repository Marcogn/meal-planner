<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useDishesStore } from '../stores/dishesStore';
import type { Dish, ProteinCategory } from '../domain/types';
import { v4 as uuidv4 } from 'uuid';

const ALL_CATEGORIES: ProteinCategory[] = [
  'CARNE_ROSSA',
  'CARNE_BIANCA',
  'PESCE',
  'LEGUMI',
  'UOVA',
  'FORMAGGIO',
  'CEREALI',
  'ALTRO',
];

const store = useDishesStore();
const search = ref('');
const filterCat = ref<ProteinCategory | ''>('');
const showForm = ref(false);
const editing = ref<Dish | null>(null);
const confirmDeleteId = ref<string | null>(null);

const form = ref<Omit<Dish, 'id' | 'createdAt'> & { name: string }>({
  name: '',
  proteinCategories: [],
  tags: [],
  notes: undefined,
});

onMounted(() => store.load());

const filtered = computed(() => {
  let list = store.dishes;
  if (filterCat.value) {
    list = list.filter((d) => d.proteinCategories.includes(filterCat.value as ProteinCategory));
  }
  if (search.value) {
    const q = search.value.toLowerCase();
    list = list.filter((d) => d.name.toLowerCase().includes(q));
  }
  return list;
});

function openCreate() {
  editing.value = null;
  form.value = { name: '', proteinCategories: [], tags: [], notes: undefined };
  showForm.value = true;
}

function openEdit(dish: Dish) {
  editing.value = dish;
  form.value = {
    name: dish.name,
    proteinCategories: [...dish.proteinCategories],
    tags: [...dish.tags],
    notes: dish.notes,
  };
  showForm.value = true;
}

async function submitForm() {
  if (!form.value.name.trim()) return;
  const dish: Dish = {
    id: editing.value?.id ?? uuidv4(),
    name: form.value.name.trim(),
    proteinCategories: form.value.proteinCategories,
    tags: form.value.tags,
    notes: form.value.notes || undefined,
    createdAt: editing.value?.createdAt ?? new Date().toISOString(),
  };
  await store.save(dish);
  showForm.value = false;
}

function toggleCategory(cat: ProteinCategory) {
  const idx = form.value.proteinCategories.indexOf(cat);
  if (idx >= 0) {
    form.value.proteinCategories.splice(idx, 1);
  } else {
    form.value.proteinCategories.push(cat);
  }
}

async function confirmDelete(id: string) {
  await store.remove(id);
  confirmDeleteId.value = null;
}

function setTags(raw: string) {
  form.value.tags = raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}
</script>

<template>
  <div>
    <h2>Piatti</h2>

    <div class="toolbar">
      <input v-model="search" placeholder="Cerca..." />
      <select v-model="filterCat">
        <option value="">Tutte le categorie</option>
        <option v-for="cat in ALL_CATEGORIES" :key="cat" :value="cat">{{ cat }}</option>
      </select>
      <button @click="openCreate">+ Nuovo piatto</button>
    </div>

    <ul class="dish-list">
      <li v-for="dish in filtered" :key="dish.id">
        <div class="dish-info">
          <strong>{{ dish.name }}</strong>
          <small v-if="dish.proteinCategories.length">
            ({{ dish.proteinCategories.join(', ') }})
          </small>
          <small v-if="dish.tags.length"> [{{ dish.tags.join(', ') }}]</small>
        </div>
        <div class="dish-actions">
          <button @click="openEdit(dish)">Modifica</button>
          <button @click="confirmDeleteId = dish.id">Elimina</button>
        </div>
      </li>
      <li v-if="filtered.length === 0" class="empty">Nessun piatto trovato.</li>
    </ul>

    <div v-if="confirmDeleteId" class="modal-overlay" @click.self="confirmDeleteId = null">
      <div class="modal">
        <p>Eliminare questo piatto?</p>
        <div class="form-actions">
          <button @click="confirmDelete(confirmDeleteId!)">Elimina</button>
          <button @click="confirmDeleteId = null">Annulla</button>
        </div>
      </div>
    </div>

    <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
      <div class="modal">
        <h3>{{ editing ? 'Modifica piatto' : 'Nuovo piatto' }}</h3>

        <label>
          Nome *
          <input v-model="form.name" required />
        </label>

        <fieldset>
          <legend>Categorie proteiche</legend>
          <label v-for="cat in ALL_CATEGORIES" :key="cat" class="checkbox-label">
            <input
              type="checkbox"
              :checked="form.proteinCategories.includes(cat)"
              @change="toggleCategory(cat)"
            />
            {{ cat }}
          </label>
        </fieldset>

        <label>
          Tag (separati da virgola)
          <input
            :value="form.tags.join(', ')"
            @input="setTags(($event.target as HTMLInputElement).value)"
          />
        </label>

        <label>
          Note
          <textarea v-model="form.notes" rows="3"></textarea>
        </label>

        <div class="form-actions">
          <button @click="submitForm">Salva</button>
          <button @click="showForm = false">Annulla</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
  align-items: center;
}

.toolbar input,
.toolbar select {
  padding: 0.3rem 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.dish-list {
  list-style: none;
  padding: 0;
}

.dish-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.dish-info {
  flex: 1;
}

.dish-actions {
  display: flex;
  gap: 0.4rem;
}

.empty {
  color: #888;
  padding: 1rem 0;
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
  width: min(480px, 95vw);
  max-height: 85vh;
  overflow-y: auto;
}

.modal label {
  display: block;
  margin-bottom: 0.75rem;
  font-size: 0.95rem;
}

.modal input:not([type='checkbox']),
.modal textarea {
  display: block;
  width: 100%;
  padding: 0.3rem 0.4rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-top: 3px;
}

fieldset {
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-right: 0.6rem;
  margin-bottom: 0.3rem;
  font-size: 0.9rem;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}
</style>
