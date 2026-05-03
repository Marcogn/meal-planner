<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSettingsStore } from '../stores/settingsStore';
import type { FrequencyConstraint, ProteinCategory } from '../domain/types';

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

const store = useSettingsStore();
const constraints = ref<FrequencyConstraint[]>([]);
const recencyWindowWeeks = ref(4);
const saved = ref(false);

onMounted(async () => {
  await store.load();
  constraints.value = store.settings.constraints.map((c) => ({ ...c }));
  recencyWindowWeeks.value = store.settings.recencyWindowWeeks;
});

function addConstraint() {
  constraints.value.push({ category: 'ALTRO' });
}

function removeConstraint(i: number) {
  constraints.value.splice(i, 1);
}

async function saveSettings() {
  await store.save({
    constraints: constraints.value.map((c) => ({
      category: c.category,
      minPerWeek:
        c.minPerWeek !== undefined && c.minPerWeek !== null
          ? Number(c.minPerWeek)
          : undefined,
      maxPerWeek:
        c.maxPerWeek !== undefined && c.maxPerWeek !== null
          ? Number(c.maxPerWeek)
          : undefined,
    })),
    recencyWindowWeeks: Number(recencyWindowWeeks.value),
  });
  saved.value = true;
  setTimeout(() => (saved.value = false), 2000);
}
</script>

<template>
  <div>
    <h2>Impostazioni</h2>

    <section>
      <h3>Finestra di recenza (settimane)</h3>
      <p>
        Penalizza i piatti usati nelle ultime
        <input
          type="number"
          v-model="recencyWindowWeeks"
          min="1"
          max="52"
          class="inline-num"
        />
        settimane.
      </p>
    </section>

    <section>
      <h3>Vincoli di frequenza</h3>

      <table v-if="constraints.length > 0">
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Min/sett.</th>
            <th>Max/sett.</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(c, i) in constraints" :key="i">
            <td>
              <select v-model="c.category">
                <option v-for="cat in ALL_CATEGORIES" :key="cat" :value="cat">
                  {{ cat }}
                </option>
              </select>
            </td>
            <td>
              <input type="number" v-model="c.minPerWeek" min="0" placeholder="—" />
            </td>
            <td>
              <input type="number" v-model="c.maxPerWeek" min="1" placeholder="—" />
            </td>
            <td>
              <button @click="removeConstraint(i)">Rimuovi</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="muted">Nessun vincolo configurato.</p>

      <button @click="addConstraint">+ Aggiungi vincolo</button>
    </section>

    <div class="save-row">
      <button class="save-btn" @click="saveSettings">Salva impostazioni</button>
      <span v-if="saved" class="status-ok">✓ Salvato</span>
    </div>
  </div>
</template>

<style scoped>
section {
  margin-bottom: 1.5rem;
}

.inline-num {
  width: 60px;
  padding: 0.2rem 0.3rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  text-align: center;
}

table {
  border-collapse: collapse;
  margin-bottom: 0.75rem;
  width: 100%;
}

th,
td {
  padding: 5px 8px;
  border: 1px solid #ddd;
  text-align: left;
}

td input[type='number'],
td select {
  padding: 0.2rem 0.3rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 70px;
}

td select {
  width: auto;
}

.muted {
  color: #888;
}

.save-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
</style>
