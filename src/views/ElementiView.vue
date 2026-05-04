<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useElementiStore, ElementValidationError } from '../stores/elementiStore';
import type { Element, FrequencyLimit } from '../domain/types';

const store = useElementiStore();

// ---- opzioni frequenza (riutilizzate da form crea e form edit) ----
const FREQ_OPTIONS: Array<{ label: string; value: FrequencyLimit }> = [
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5', value: 5 },
  { label: '∞', value: 'unlimited' },
];

onMounted(() => store.load());

function freqLabel(limit: FrequencyLimit): string {
  return limit === 'unlimited' ? '∞' : String(limit);
}

// ---- form creazione ----
const showCreateForm = ref(false);
const createName = ref('');
const createFreq = ref<FrequencyLimit>(3);
const createError = ref('');

function openCreateForm() {
  createName.value = '';
  createFreq.value = 3;
  createError.value = '';
  showCreateForm.value = true;
}

function closeCreateForm() {
  showCreateForm.value = false;
}

async function submitCreate() {
  createError.value = '';
  try {
    await store.create({ name: createName.value, maxFrequencyPerWeek: createFreq.value });
    closeCreateForm();
  } catch (e) {
    if (e instanceof ElementValidationError) {
      createError.value = e.message;
    } else {
      createError.value = 'Errore imprevisto. Riprova.';
    }
  }
}

// ---- form modifica ----
const showEditForm = ref(false);
const editId = ref('');
const editName = ref('');
const editFreq = ref<FrequencyLimit>(3);
const editError = ref('');

function openEditForm(el: Element) {
  editId.value = el.id;
  editName.value = el.name;
  editFreq.value = el.maxFrequencyPerWeek;
  editError.value = '';
  showEditForm.value = true;
}

function closeEditForm() {
  showEditForm.value = false;
}

async function submitEdit() {
  editError.value = '';
  try {
    await store.update(editId.value, {
      name: editName.value,
      maxFrequencyPerWeek: editFreq.value,
    });
    closeEditForm();
  } catch (e) {
    if (e instanceof ElementValidationError) {
      editError.value = e.message;
    } else {
      editError.value = 'Errore imprevisto. Riprova.';
    }
  }
}

// ---- dialog conferma eliminazione ----
const showDeleteConfirm = ref(false);
const deleteId = ref('');
const deleteName = ref('');
const deleteUsageCount = ref(0);

async function openDeleteConfirm(el: Element) {
  deleteId.value = el.id;
  deleteName.value = el.name;
  deleteUsageCount.value = await store.countUsage(el.id);
  showDeleteConfirm.value = true;
}

function closeDeleteConfirm() {
  showDeleteConfirm.value = false;
}

async function confirmDelete() {
  await store.remove(deleteId.value);
  closeDeleteConfirm();
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>Elementi</h2>
      <button class="btn-primary" @click="openCreateForm">+ Nuovo elemento</button>
    </div>

    <!-- Lista -->
    <ul v-if="store.elements.length > 0" class="element-list">
      <li v-for="el in store.elements" :key="el.id" class="element-item">
        <span class="element-name">{{ el.name }}</span>
        <span class="element-freq">
          Max: <strong>{{ freqLabel(el.maxFrequencyPerWeek) }}</strong>/sett.
        </span>
        <div class="element-actions">
          <button class="btn-icon" title="Modifica" @click="openEditForm(el)">✏️</button>
          <button class="btn-icon btn-danger" title="Elimina" @click="openDeleteConfirm(el)">🗑️</button>
        </div>
      </li>
    </ul>
    <p v-else class="empty-state">Nessun elemento ancora — aggiungine uno.</p>

    <!-- Form creazione -->
    <div v-if="showCreateForm" class="modal-overlay" @click.self="closeCreateForm">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <h3 id="create-title">Nuovo elemento</h3>

        <label for="create-name">Nome *</label>
        <input
          id="create-name"
          v-model="createName"
          type="text"
          placeholder="es. formaggio"
          autocomplete="off"
          @keyup.enter="submitCreate"
        />

        <label for="create-freq">Frequenza massima settimanale *</label>
        <select id="create-freq" v-model="createFreq">
          <option v-for="opt in FREQ_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>

        <p v-if="createError" class="form-error" role="alert">{{ createError }}</p>

        <div class="form-actions">
          <button class="btn-primary" @click="submitCreate">Salva</button>
          <button @click="closeCreateForm">Annulla</button>
        </div>
      </div>
    </div>

    <!-- Form modifica -->
    <div v-if="showEditForm" class="modal-overlay" @click.self="closeEditForm">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <h3 id="edit-title">Modifica elemento</h3>

        <label for="edit-name">Nome *</label>
        <input
          id="edit-name"
          v-model="editName"
          type="text"
          autocomplete="off"
          @keyup.enter="submitEdit"
        />

        <label for="edit-freq">Frequenza massima settimanale *</label>
        <select id="edit-freq" v-model="editFreq">
          <option v-for="opt in FREQ_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>

        <p v-if="editError" class="form-error" role="alert">{{ editError }}</p>

        <div class="form-actions">
          <button class="btn-primary" @click="submitEdit">Salva</button>
          <button @click="closeEditForm">Annulla</button>
        </div>
      </div>
    </div>

    <!-- Dialog conferma eliminazione -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="closeDeleteConfirm">
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
        <h3 id="delete-title">Elimina elemento</h3>
        <p>
          Vuoi eliminare <strong>{{ deleteName }}</strong>?
        </p>
        <p v-if="deleteUsageCount > 0" class="delete-warning">
          ⚠️ Questo elemento è usato in
          <strong>{{ deleteUsageCount }} {{ deleteUsageCount === 1 ? 'piatto' : 'piatti' }}</strong>.
          I piatti resteranno, perderanno solo questo elemento.
        </p>
        <div class="form-actions">
          <button class="btn-danger-solid" @click="confirmDelete">Elimina</button>
          <button @click="closeDeleteConfirm">Annulla</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.toolbar h2 {
  margin: 0;
}

.btn-primary {
  background: #1a7a1a;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 0.45rem 0.9rem;
  font-size: 0.95rem;
  cursor: pointer;
  min-height: 44px;
}

.btn-primary:hover {
  background: #155e15;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0.25rem 0.4rem;
  min-height: 44px;
  min-width: 44px;
  border-radius: 4px;
}

.btn-icon:hover {
  background: #f0f0f0;
}

.btn-danger-solid {
  background: #c0392b;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 0.45rem 0.9rem;
  font-size: 0.95rem;
  cursor: pointer;
  min-height: 44px;
}

.btn-danger-solid:hover {
  background: #a93226;
}

.element-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.element-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
  gap: 0.5rem;
}

.element-name {
  font-weight: 500;
  flex: 1;
}

.element-freq {
  font-size: 0.9rem;
  color: #555;
  white-space: nowrap;
}

.element-actions {
  display: flex;
  gap: 0.1rem;
}

.empty-state {
  color: #888;
  font-style: italic;
  margin-top: 1rem;
}

.delete-warning {
  color: #c0392b;
  font-size: 0.9rem;
}

/* modal */
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
  width: min(420px, 95vw);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.modal h3 {
  margin: 0 0 0.5rem;
}

.modal label {
  font-size: 0.9rem;
  font-weight: 500;
}

.modal input,
.modal select {
  padding: 0.4rem 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  width: 100%;
}

.form-error {
  color: #cc0000;
  font-size: 0.9rem;
  margin: 0;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
</style>

