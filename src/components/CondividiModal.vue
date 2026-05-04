<!--
  CondividiModal — T6.2
  =====================
  Modal per esportare il menù di una o più settimane come file JSON da condividere.

  Offre due modalità:
  - "questa settimana": esporta solo la settimana correntemente visualizzata.
  - "intervallo": mostra una lista di 9 settimane (±4 rispetto alla corrente)
    con checkboxes; l'utente può selezionarne quante vuole.

  Il file scaricato usa lo stesso formato `BackupData` del backup completo
  (solo con gli Elementi effettivamente referenziati), così la funzione
  `parseSharedFile` può validarlo senza codice aggiuntivo.

  Props
  -----
  currentWeekId — ID ISO della settimana attualmente visualizzata (es. "2026-W19")

  Emits
  -----
  close — chiudere il modal (dopo export riuscito o annullamento)
-->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { nextWeek, prevWeek, formatWeekLabel } from '../domain/week';
import { exportWeeks } from '../storage/backup';

const props = defineProps<{
  /** ID ISO della settimana correntemente visualizzata, es. "2026-W19". */
  currentWeekId: string;
}>();

const emit = defineEmits<{
  /** Emesso quando il modal deve essere chiuso (export completato o annullato). */
  close: [];
}>();

// ── Modalità di selezione ──────────────────────────────────────────────────

type Modalita = 'questa' | 'intervallo';
const modalita = ref<Modalita>('questa');

// ── Lista settimane per la modalità "intervallo" ───────────────────────────

/**
 * Genera una lista di weekId centrata su `anchor`, con `before` settimane
 * prima e `after` settimane dopo.
 */
function buildWeekRange(anchor: string, before = 4, after = 4): string[] {
  const ids: string[] = [];

  // Settimane precedenti (aggiunte in ordine cronologico)
  let tmp = anchor;
  const preceding: string[] = [];
  for (let i = 0; i < before; i++) {
    tmp = prevWeek(tmp);
    preceding.unshift(tmp);
  }
  ids.push(...preceding, anchor);

  // Settimane successive
  let fwd = anchor;
  for (let i = 0; i < after; i++) {
    fwd = nextWeek(fwd);
    ids.push(fwd);
  }

  return ids;
}

const availableWeeks = computed(() => buildWeekRange(props.currentWeekId));

// Settimane selezionate nell'intervallo (default: solo la corrente)
const selectedIds = ref<Set<string>>(new Set([props.currentWeekId]));

function toggleWeek(id: string) {
  // Nuovo Set per preservare la reattività Vue
  const next = new Set(selectedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selectedIds.value = next;
}

/** IDs effettivi da esportare in base alla modalità scelta. */
const weekIdsToExport = computed<string[]>(() =>
  modalita.value === 'questa'
    ? [props.currentWeekId]
    : [...selectedIds.value],
);

// ── Esportazione ──────────────────────────────────────────────────────────

const exporting = ref(false);
const exportError = ref('');

async function handleExport() {
  if (weekIdsToExport.value.length === 0) {
    exportError.value = 'Seleziona almeno una settimana.';
    return;
  }

  exportError.value = '';
  exporting.value = true;
  try {
    const blob = await exportWeeks(weekIdsToExport.value);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `menu-planner-share-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    emit('close');
  } catch {
    exportError.value = "Errore durante l'esportazione. Riprova.";
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="condividi-title"
    >
      <h3 id="condividi-title">Condividi menù</h3>
      <p class="modal-desc">
        Scegli le settimane da esportare come file JSON da inviare ad altri.
      </p>

      <!-- Selezione modalità -->
      <div class="mode-group" role="group" aria-labelledby="mode-legend">
        <span id="mode-legend" class="sr-only">Modalità di selezione</span>

        <label class="mode-option">
          <input v-model="modalita" type="radio" name="modalita" value="questa" />
          <span>
            Questa settimana
            <span class="week-hint">({{ formatWeekLabel(currentWeekId) }})</span>
          </span>
        </label>

        <label class="mode-option">
          <input v-model="modalita" type="radio" name="modalita" value="intervallo" />
          <span>Scegli settimane</span>
        </label>
      </div>

      <!-- Lista settimane (solo in modalità intervallo) -->
      <div
        v-if="modalita === 'intervallo'"
        class="week-list"
        role="group"
        aria-label="Settimane disponibili"
      >
        <label
          v-for="weekId in availableWeeks"
          :key="weekId"
          class="week-row"
        >
          <input
            type="checkbox"
            :checked="selectedIds.has(weekId)"
            @change="toggleWeek(weekId)"
          />
          <span :class="{ 'week-current': weekId === currentWeekId }">
            {{ formatWeekLabel(weekId) }}
            <span v-if="weekId === currentWeekId" class="current-badge" aria-hidden="true">
              ← questa
            </span>
          </span>
        </label>
      </div>

      <!-- Errore -->
      <p v-if="exportError" class="error-msg" role="alert">{{ exportError }}</p>

      <!-- Azioni -->
      <div class="form-actions">
        <button
          class="btn-primary"
          :disabled="exporting || weekIdsToExport.length === 0"
          @click="handleExport"
        >
          {{
            exporting
              ? 'Esportazione…'
              : weekIdsToExport.length === 1
                ? '📤 Scarica'
                : `📤 Scarica (${weekIdsToExport.length} settimane)`
          }}
        </button>
        <button @click="emit('close')">Annulla</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.modal h3 {
  margin: 0;
  font-size: 1.1rem;
}

.modal-desc {
  margin: 0;
  font-size: 0.9rem;
  color: #555;
}

/* ── Modalità ── */
.mode-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.95rem;
  padding: 0.3rem 0;
}

.week-hint {
  font-size: 0.85rem;
  color: #666;
  margin-left: 0.25rem;
}

/* ── Lista settimane ── */
.week-list {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 260px;
  overflow-y: auto;
}

.week-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.2rem 0;
}

.week-row input[type='checkbox'] {
  flex-shrink: 0;
}

.week-current {
  font-weight: 600;
}

.current-badge {
  font-size: 0.78rem;
  color: #2244aa;
  font-weight: 400;
  margin-left: 0.25rem;
}

/* ── Azioni ── */
.form-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.btn-primary {
  background: #1a7a1a;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  font-size: 0.95rem;
  cursor: pointer;
  min-height: 44px;
}

.btn-primary:hover:not(:disabled) {
  background: #155e15;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-msg {
  color: #cc0000;
  font-size: 0.9rem;
  margin: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
