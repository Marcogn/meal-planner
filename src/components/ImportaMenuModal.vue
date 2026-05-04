<!--
  ImportaMenuModal — T6.3
  =======================
  Modal per importare un menù condiviso.

  Flusso:
  1. Stato "selezione file": l'utente sceglie un file JSON con un file picker.
  2. Stato "anteprima": il file viene parsato con `parseSharedFile`; se valido
     viene mostrato un riepilogo delle settimane, degli slot e degli elementi
     presenti nel file.
  3. Il pulsante "Prosegui →" emette `confirm` con il `BackupData` parsato,
     consentendo al componente padre di procedere con la scelta della modalità
     di import (T6.4).

  Emits
  -----
  close   — chiudere il modal senza importare nulla
  confirm — l'utente ha visto l'anteprima ed è pronto a procedere;
             payload: `{ data: BackupData }` (gestito in T6.4)
-->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { parseSharedFile, BackupImportError, type BackupData } from '../storage/backup';
import { formatWeekLabel } from '../domain/week';
import type { Element } from '../domain/types';

const emit = defineEmits<{
  /** Chiude il modal senza importare nulla. */
  close: [];
  /**
   * L'utente ha confermato di voler procedere con l'import.
   * Il gestore (T6.4) riceverà il `BackupData` già validato.
   */
  confirm: [data: BackupData];
}>();

// ── Stato interno ──────────────────────────────────────────────────────────

type Step = 'pick' | 'parsing' | 'preview' | 'error';
const step = ref<Step>('pick');
const parseError = ref('');

/** Dati parsati e validati dal file selezionato. */
const parsedData = ref<BackupData | null>(null);

// Riferimento all'input file nascosto
const fileInputRef = ref<HTMLInputElement | null>(null);

// ── Nomi pasto e giorno per la visualizzazione preview ─────────────────────

const MEAL_LABELS: Record<string, string> = {
  colazione: 'Colazione',
  merenda_mattina: 'Merenda mat.',
  pranzo: 'Pranzo',
  merenda_pomeriggio: 'Merenda pom.',
  cena: 'Cena',
};

const DAY_LABELS: Record<number, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mer',
  4: 'Gio',
  5: 'Ven',
  6: 'Sab',
  7: 'Dom',
};

// ── Dati calcolati per la preview ──────────────────────────────────────────

/**
 * Mappa elementId → Element per i lookup veloci durante la preview.
 * Costruita dai dati nel file (non dal DB locale).
 */
const elementMap = computed<Map<string, Element>>(() => {
  const map = new Map<string, Element>();
  if (!parsedData.value) return map;
  for (const el of parsedData.value.elements) {
    map.set(el.id, el);
  }
  return map;
});

/**
 * Lista ordinata (day ASC, meal per ordine cronologico) degli slot non vuoti
 * per una settimana nel file di preview.
 */
function slotsOf(week: BackupData['weeks'][0]) {
  const MEAL_ORDER = [
    'colazione',
    'merenda_mattina',
    'pranzo',
    'merenda_pomeriggio',
    'cena',
  ];
  return week.slots
    .filter((s) => s.dishes.length > 0)
    .sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal);
    });
}

/** Formatta il nome di un giorno + pasto (es. "Lun · Pranzo"). */
function slotLabel(day: number, meal: string): string {
  return `${DAY_LABELS[day] ?? `G${day}`} · ${MEAL_LABELS[meal] ?? meal}`;
}

/** Nomi degli elementi di un piatto, separati da virgola. */
function elementNames(elementIds: string[]): string {
  if (elementIds.length === 0) return '';
  return elementIds
    .map((id) => elementMap.value.get(id)?.name ?? '(eliminato)')
    .join(', ');
}

/** Conteggio totale piatti nel file. */
const totalDishes = computed<number>(() => {
  if (!parsedData.value) return 0;
  return parsedData.value.weeks.reduce(
    (sum, w) => sum + w.slots.reduce((s, sl) => s + sl.dishes.length, 0),
    0,
  );
});

// ── Gestione file ──────────────────────────────────────────────────────────

function openFilePicker() {
  parseError.value = '';
  fileInputRef.value?.click();
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  // Reset per permettere di riaprire lo stesso file
  input.value = '';

  step.value = 'parsing';
  parseError.value = '';
  parsedData.value = null;

  try {
    parsedData.value = await parseSharedFile(file);
    step.value = 'preview';
  } catch (e) {
    parseError.value =
      e instanceof BackupImportError
        ? e.message
        : 'Errore imprevisto durante la lettura del file.';
    step.value = 'error';
  }
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="importa-title"
    >
      <h3 id="importa-title">Importa menù condiviso</h3>

      <!-- ── Step 1: selezione file ── -->
      <template v-if="step === 'pick'">
        <p class="modal-desc">
          Seleziona un file JSON esportato da un altro dispositivo con
          "Condividi menù".
        </p>
        <input
          ref="fileInputRef"
          type="file"
          accept=".json,application/json"
          class="visually-hidden"
          @change="onFileSelected"
        />
        <div class="form-actions">
          <button class="btn-primary" @click="openFilePicker">
            📂 Seleziona file…
          </button>
          <button @click="emit('close')">Annulla</button>
        </div>
      </template>

      <!-- ── Step 2: parsing in corso ── -->
      <template v-else-if="step === 'parsing'">
        <p class="modal-desc">Lettura del file in corso…</p>
      </template>

      <!-- ── Step 3: errore di parsing ── -->
      <template v-else-if="step === 'error'">
        <p class="error-msg" role="alert">{{ parseError }}</p>
        <div class="form-actions">
          <button class="btn-secondary" @click="step = 'pick'">
            ← Riprova
          </button>
          <button @click="emit('close')">Chiudi</button>
        </div>
      </template>

      <!-- ── Step 4: anteprima ── -->
      <template v-else-if="step === 'preview' && parsedData">
        <!-- Riepilogo numerico -->
        <div class="preview-summary">
          <span class="summary-chip">
            🗓 {{ parsedData.weeks.length }}
            {{ parsedData.weeks.length === 1 ? 'settimana' : 'settimane' }}
          </span>
          <span class="summary-chip">
            🍽 {{ totalDishes }}
            {{ totalDishes === 1 ? 'piatto' : 'piatti' }}
          </span>
          <span v-if="parsedData.elements.length > 0" class="summary-chip">
            🏷 {{ parsedData.elements.length }}
            {{ parsedData.elements.length === 1 ? 'elemento' : 'elementi' }}
          </span>
        </div>

        <!-- Elenco elementi referenziati -->
        <div v-if="parsedData.elements.length > 0" class="elements-preview">
          <strong class="section-label">Elementi nel file:</strong>
          <span class="elements-list">
            {{ parsedData.elements.map((e) => e.name).join(', ') }}
          </span>
        </div>

        <!-- Dettaglio per settimana -->
        <div class="weeks-preview">
          <details
            v-for="week in parsedData.weeks"
            :key="week.id"
            class="week-details"
            open
          >
            <summary class="week-summary">
              <strong>{{ formatWeekLabel(week.id) }}</strong>
              <span class="week-dish-count">
                ({{ week.slots.reduce((s, sl) => s + sl.dishes.length, 0) }} piatti)
              </span>
            </summary>

            <div v-if="slotsOf(week).length === 0" class="no-dishes">
              Nessun piatto in questa settimana.
            </div>

            <ul v-else class="slot-list">
              <li
                v-for="slot in slotsOf(week)"
                :key="`${slot.day}-${slot.meal}`"
                class="slot-item"
              >
                <span class="slot-label">{{ slotLabel(slot.day, slot.meal) }}</span>
                <ul class="dish-list">
                  <li
                    v-for="dish in slot.dishes"
                    :key="dish.id"
                    class="dish-item"
                  >
                    {{ dish.name }}
                    <span
                      v-if="dish.elementIds.length > 0"
                      class="dish-elements"
                    >
                      ({{ elementNames(dish.elementIds) }})
                    </span>
                  </li>
                </ul>
              </li>
            </ul>
          </details>
        </div>

        <!-- Azioni -->
        <div class="form-actions">
          <!--
            TODO T6.4: wiring "Prosegui →" → apre selezione modalità import
            (sovrascrivi / granulare). Per ora emette `confirm` che il gestore
            in WeekView gestirà.
          -->
          <button
            class="btn-primary"
            @click="emit('confirm', parsedData)"
          >
            Prosegui →
          </button>
          <button @click="emit('close')">Annulla</button>
        </div>
      </template>
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
  width: min(520px, 95vw);
  max-height: 88vh;
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

/* ── Riepilogo numerico ── */
.preview-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.summary-chip {
  background: #eef2ff;
  color: #2244aa;
  border-radius: 12px;
  padding: 0.2rem 0.7rem;
  font-size: 0.88rem;
  font-weight: 600;
}

/* ── Elementi ── */
.section-label {
  font-size: 0.88rem;
}

.elements-preview {
  font-size: 0.88rem;
  color: #444;
  background: #f5f5f5;
  border-radius: 4px;
  padding: 0.4rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.elements-list {
  font-style: italic;
}

/* ── Settimane ── */
.weeks-preview {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 340px;
  overflow-y: auto;
}

.week-details {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 0.4rem 0.7rem;
}

.week-summary {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  list-style: none;
  padding: 0.2rem 0;
}

.week-summary::-webkit-details-marker {
  display: none;
}

.week-dish-count {
  font-size: 0.82rem;
  color: #777;
  font-weight: 400;
}

.no-dishes {
  font-size: 0.85rem;
  color: #999;
  padding: 0.2rem 0 0.3rem;
}

.slot-list {
  list-style: none;
  padding: 0;
  margin: 0.25rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.slot-item {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.slot-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: #2244aa;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.dish-list {
  list-style: none;
  padding: 0 0 0 0.8rem;
  margin: 0;
}

.dish-item {
  font-size: 0.88rem;
  color: #333;
  padding: 0.05rem 0;
}

.dish-elements {
  font-size: 0.8rem;
  color: #777;
}

/* ── Azioni ── */
.form-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.btn-primary {
  background: #2244aa;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  font-size: 0.95rem;
  cursor: pointer;
  min-height: 44px;
}

.btn-primary:hover {
  background: #1a3388;
}

.btn-secondary {
  background: #fff;
  color: #1a1a1a;
  border: 1px solid #aaa;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  font-size: 0.95rem;
  cursor: pointer;
  min-height: 44px;
}

.btn-secondary:hover {
  background: #f0f0f0;
}

.error-msg {
  color: #cc0000;
  font-size: 0.9rem;
  margin: 0;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
