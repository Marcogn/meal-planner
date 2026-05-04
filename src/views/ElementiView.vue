<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useElementiStore, ElementValidationError } from '../stores/elementiStore';
import type { FrequencyLimit } from '../domain/types';

const store = useElementiStore();

// ---- form creazione ----
const showForm = ref(false);
const formName = ref('');
const formFreq = ref<FrequencyLimit>(3);
const formError = ref('');

const FREQ_OPTIONS: Array<{ label: string; value: FrequencyLimit }> = [
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
  { label: '5', value: 5 },
  { label: '∞', value: 'unlimited' },
];

onMounted(() => store.load());

function openForm() {
  formName.value = '';
  formFreq.value = 3;
  formError.value = '';
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
}

async function submitForm() {
  formError.value = '';
  try {
    await store.create({ name: formName.value, maxFrequencyPerWeek: formFreq.value });
    closeForm();
  } catch (e) {
    if (e instanceof ElementValidationError) {
      formError.value = e.message;
    } else {
      formError.value = 'Errore imprevisto. Riprova.';
    }
  }
}

function freqLabel(limit: FrequencyLimit): string {
  return limit === 'unlimited' ? '∞' : String(limit);
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h2>Elementi</h2>
      <button class="btn-primary" @click="openForm">+ Nuovo elemento</button>
    </div>

    <!-- Lista -->
    <ul v-if="store.elements.length > 0" class="element-list">
      <li v-for="el in store.elements" :key="el.id" class="element-item">
        <span class="element-name">{{ el.name }}</span>
        <span class="element-freq">
          Max: <strong>{{ freqLabel(el.maxFrequencyPerWeek) }}</strong>/sett.
        </span>
      </li>
    </ul>
    <p v-else class="empty-state">Nessun elemento ancora — aggiungine uno.</p>

    <!-- Form creazione -->
    <div v-if="showForm" class="modal-overlay" @click.self="closeForm">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
        <h3 id="form-title">Nuovo elemento</h3>

        <label for="el-name">Nome *</label>
        <input
          id="el-name"
          v-model="formName"
          type="text"
          placeholder="es. formaggio"
          autocomplete="off"
          @keyup.enter="submitForm"
        />

        <label for="el-freq">Frequenza massima settimanale *</label>
        <select id="el-freq" v-model="formFreq">
          <option v-for="opt in FREQ_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>

        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

        <div class="form-actions">
          <button class="btn-primary" @click="submitForm">Salva</button>
          <button @click="closeForm">Annulla</button>
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

.element-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.element-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
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

.empty-state {
  color: #888;
  font-style: italic;
  margin-top: 1rem;
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
