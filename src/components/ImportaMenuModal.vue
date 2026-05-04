<!--
  ImportaMenuModal — T6.3 / T6.4 / T6.5 / T6.6
  ===============================================
  Modal per importare un menù condiviso.

  Flusso:
  1. "pick"              — l'utente sceglie un file JSON con un file picker.
  2. "parsing"           — parsing in corso.
  3. "preview"           — riepilogo del file (settimane, piatti, elementi).
  4. "mode-select"       — (T6.4) radio "Sovrascrivi tutto" / "Scegli slot per slot".
  5. "granular-select"   — (T6.5) checkbox per ogni (giorno, pasto) con piatti.
  6. "element-review"    — (T6.6) risoluzione elementi mancanti e conflitti di frequenza.
                           Viene saltato automaticamente se non ci sono problemi da risolvere.

  Emits
  -----
  close   — chiudere il modal senza importare nulla
  confirm — l'utente ha completato tutti gli step;
            payload: BackupData, ImportMode, SlotKey[], ElementImportDecisions
-->
<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  parseSharedFile,
  BackupImportError,
  analyzeElementImport,
  type BackupData,
  type ImportMode,
  type SlotKey,
  type ElementImportAnalysis,
  type ElementImportDecisions,
} from '../storage/backup';
import { formatWeekLabel } from '../domain/week';
import type { Element } from '../domain/types';

const emit = defineEmits<{
  /** Chiude il modal senza importare nulla. */
  close: [];
  /**
   * L'utente ha completato tutti gli step di import.
   * Il gestore in WeekView chiamerà `applyElementDecisions(data, decisions)`
   * poi `importWeeks(processedData, mode, selectedSlots)`.
   */
  confirm: [
    data: BackupData,
    mode: ImportMode,
    selectedSlots: SlotKey[],
    decisions: ElementImportDecisions,
  ];
}>();

// ── Stato interno ──────────────────────────────────────────────────────────

type Step =
  | 'pick'
  | 'parsing'
  | 'preview'
  | 'error'
  | 'mode-select'
  | 'granular-select'
  | 'element-review';

const step = ref<Step>('pick');
const parseError = ref('');

/** Dati parsati e validati dal file selezionato. */
const parsedData = ref<BackupData | null>(null);

// Riferimento all'input file nascosto
const fileInputRef = ref<HTMLInputElement | null>(null);

// ── T6.4 — Selezione modalità ──────────────────────────────────────────────

const importMode = ref<ImportMode>('overwrite');

// ── T6.5 — Selezione granulare degli slot ─────────────────────────────────

/** Uno slot selezionabile nella vista granulare. */
interface GranularSlot {
  key: SlotKey;
  label: string;
  dishCount: number;
  checked: boolean;
}

const granularSlots = ref<GranularSlot[]>([]);

/** Almeno uno slot spuntato (serve per abilitare il pulsante Importa). */
const hasCheckedSlots = computed(() => granularSlots.value.some((s) => s.checked));

function buildGranularSlots(data: BackupData): GranularSlot[] {
  const MEAL_ORDER = [
    'colazione',
    'merenda_mattina',
    'pranzo',
    'merenda_pomeriggio',
    'cena',
  ];
  const slots: GranularSlot[] = [];
  for (const week of data.weeks) {
    const wLabel = formatWeekLabel(week.id);
    const sorted = week.slots
      .filter((s) => s.dishes.length > 0)
      .sort((a, b) => {
        if (a.day !== b.day) return a.day - b.day;
        return MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal);
      });
    for (const slot of sorted) {
      slots.push({
        key: { weekId: week.id, day: slot.day, meal: slot.meal },
        label: `${wLabel} · ${slotLabel(slot.day, slot.meal)}`,
        dishCount: slot.dishes.length,
        checked: true,
      });
    }
  }
  return slots;
}

function toggleAll(checked: boolean) {
  for (const s of granularSlots.value) {
    s.checked = checked;
  }
}

// ── T6.6 — Risoluzione elementi mancanti e conflitti ──────────────────────

interface MissingDecisionState {
  element: Element;
  add: boolean;
}

interface ConflictDecisionState {
  fileElementId: string;
  fileElement: Element;
  localElement: Element;
  resolution: 'keep-local' | 'overwrite' | 'rename';
  newName: string;
}

const elementAnalysis = ref<ElementImportAnalysis | null>(null);
const missingDecisions = ref<MissingDecisionState[]>([]);
const conflictDecisions = ref<ConflictDecisionState[]>([]);

/** Vero quando tutti i conflitti "rename" hanno un nome non vuoto. */
const canConfirmElementReview = computed(() =>
  conflictDecisions.value.every(
    (d) => d.resolution !== 'rename' || d.newName.trim().length > 0,
  ),
);

/**
 * Analizza gli elementi del file e, se necessario, mostra lo step di risoluzione.
 * Se non ci sono problemi, emette direttamente `confirm`.
 */
async function goToElementReview() {
  if (!parsedData.value) return;

  const analysis = await analyzeElementImport(parsedData.value);
  elementAnalysis.value = analysis;

  if (analysis.missing.length === 0 && analysis.conflicts.length === 0) {
    // Niente da risolvere → emetti subito con decisioni vuote
    emitConfirm({ addMissingIds: [], conflicts: [] });
    return;
  }

  missingDecisions.value = analysis.missing.map((el) => ({ element: el, add: true }));
  conflictDecisions.value = analysis.conflicts.map((c) => ({
    fileElementId: c.fileElement.id,
    fileElement: c.fileElement,
    localElement: c.localElement,
    resolution: 'keep-local',
    newName: '',
  }));
  step.value = 'element-review';
}

function confirmElementReview() {
  const decisions: ElementImportDecisions = {
    addMissingIds: missingDecisions.value.filter((d) => d.add).map((d) => d.element.id),
    conflicts: conflictDecisions.value.map((d) => ({
      fileElementId: d.fileElementId,
      resolution: d.resolution,
      ...(d.resolution === 'rename' ? { newName: d.newName.trim() } : {}),
    })),
  };
  emitConfirm(decisions);
}

function emitConfirm(decisions: ElementImportDecisions) {
  if (!parsedData.value) return;
  const selectedSlots =
    importMode.value === 'granular'
      ? granularSlots.value.filter((s) => s.checked).map((s) => s.key)
      : [];
  emit('confirm', parsedData.value, importMode.value, selectedSlots, decisions);
}

// ── Nomi pasto e giorno ────────────────────────────────────────────────────

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

function slotLabel(day: number, meal: string): string {
  return `${DAY_LABELS[day] ?? `G${day}`} · ${MEAL_LABELS[meal] ?? meal}`;
}

/** Formatta `maxFrequencyPerWeek` come etichetta leggibile. */
function freqLabel(freq: Element['maxFrequencyPerWeek']): string {
  return freq === 'unlimited' ? '∞/sett' : `max ${freq}/sett`;
}

// ── Dati calcolati per la preview ──────────────────────────────────────────

const elementMap = computed<Map<string, Element>>(() => {
  const map = new Map<string, Element>();
  if (!parsedData.value) return map;
  for (const el of parsedData.value.elements) {
    map.set(el.id, el);
  }
  return map;
});

function getOrderedNonEmptySlots(week: BackupData['weeks'][0]) {
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

function elementNames(elementIds: string[]): string {
  if (elementIds.length === 0) return '';
  return elementIds.map((id) => elementMap.value.get(id)?.name ?? '(eliminato)').join(', ');
}

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

// ── Navigazione tra step ───────────────────────────────────────────────────

function goToModeSelect() {
  importMode.value = 'overwrite';
  step.value = 'mode-select';
}

function goToGranularSelect() {
  if (!parsedData.value) return;
  granularSlots.value = buildGranularSlots(parsedData.value);
  step.value = 'granular-select';
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
          <button class="btn-secondary" @click="step = 'pick'">← Riprova</button>
          <button @click="emit('close')">Chiudi</button>
        </div>
      </template>

      <!-- ── Step 4: anteprima ── -->
      <template v-else-if="step === 'preview' && parsedData">
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

        <div v-if="parsedData.elements.length > 0" class="elements-preview">
          <strong class="section-label">Elementi nel file:</strong>
          <span class="elements-list">
            {{ parsedData.elements.map((e) => e.name).join(', ') }}
          </span>
        </div>

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

            <div v-if="getOrderedNonEmptySlots(week).length === 0" class="no-dishes">
              Nessun piatto in questa settimana.
            </div>

            <ul v-else class="slot-list">
              <li
                v-for="slot in getOrderedNonEmptySlots(week)"
                :key="`${slot.day}-${slot.meal}`"
                class="slot-item"
              >
                <span class="slot-label">{{ slotLabel(slot.day, slot.meal) }}</span>
                <ul class="dish-list">
                  <li v-for="dish in slot.dishes" :key="dish.id" class="dish-item">
                    {{ dish.name }}
                    <span v-if="dish.elementIds.length > 0" class="dish-elements">
                      ({{ elementNames(dish.elementIds) }})
                    </span>
                  </li>
                </ul>
              </li>
            </ul>
          </details>
        </div>

        <div class="form-actions">
          <button class="btn-primary" @click="goToModeSelect">Prosegui →</button>
          <button @click="emit('close')">Annulla</button>
        </div>
      </template>

      <!-- ── Step 5: scelta modalità (T6.4) ── -->
      <template v-else-if="step === 'mode-select'">
        <p class="modal-desc">Come vuoi importare il menù ricevuto?</p>

        <div class="mode-options">
          <label class="mode-option">
            <input v-model="importMode" type="radio" name="import-mode" value="overwrite" />
            <span class="mode-option-content">
              <strong>Sovrascrivi tutto</strong>
              <span class="mode-option-desc">
                Sostituisce interamente le settimane presenti nel file. Le altre
                settimane locali restano invariate.
              </span>
            </span>
          </label>

          <label class="mode-option">
            <input v-model="importMode" type="radio" name="import-mode" value="granular" />
            <span class="mode-option-content">
              <strong>Scegli slot per slot</strong>
              <span class="mode-option-desc">
                Scegli esattamente quali pasti importare. Per ogni slot
                selezionato, i piatti del file sostituiranno i tuoi.
              </span>
            </span>
          </label>
        </div>

        <div class="form-actions">
          <button
            v-if="importMode === 'overwrite'"
            class="btn-primary"
            @click="goToElementReview"
          >
            Avanti →
          </button>
          <button v-else class="btn-primary" @click="goToGranularSelect">
            Avanti →
          </button>
          <button class="btn-secondary" @click="step = 'preview'">← Indietro</button>
        </div>
      </template>

      <!-- ── Step 6: selezione granulare slot (T6.5) ── -->
      <template v-else-if="step === 'granular-select'">
        <p class="modal-desc">
          Seleziona i pasti da importare. I piatti presenti negli slot spuntati
          sostituiranno quelli locali.
        </p>

        <div class="granular-toolbar">
          <button class="link-btn" @click="toggleAll(true)">Seleziona tutti</button>
          <span class="separator">·</span>
          <button class="link-btn" @click="toggleAll(false)">Deseleziona tutti</button>
        </div>

        <div class="granular-list">
          <label
            v-for="(gs, idx) in granularSlots"
            :key="idx"
            class="granular-item"
            :class="{ 'granular-item--checked': gs.checked }"
          >
            <input v-model="gs.checked" type="checkbox" class="granular-checkbox" />
            <span class="granular-label">
              {{ gs.label }}
              <span class="granular-count">
                ({{ gs.dishCount }} {{ gs.dishCount === 1 ? 'piatto' : 'piatti' }})
              </span>
            </span>
          </label>

          <p v-if="granularSlots.length === 0" class="no-dishes">
            Nessun piatto nel file da importare.
          </p>
        </div>

        <div class="form-actions">
          <button
            class="btn-primary"
            :disabled="!hasCheckedSlots"
            @click="goToElementReview"
          >
            Avanti →
          </button>
          <button class="btn-secondary" @click="step = 'mode-select'">← Indietro</button>
        </div>
      </template>

      <!-- ── Step 7: risoluzione elementi (T6.6) ── -->
      <template v-else-if="step === 'element-review' && elementAnalysis">
        <p class="modal-desc">
          Alcuni elementi del file non corrispondono al tuo archivio locale.
          Scegli come gestirli.
        </p>

        <!-- Sezione: elementi mancanti -->
        <div v-if="missingDecisions.length > 0" class="er-section">
          <strong class="er-section-title">
            🆕 {{ missingDecisions.length }}
            {{ missingDecisions.length === 1 ? 'elemento nuovo' : 'elementi nuovi' }}
          </strong>
          <p class="er-section-desc">
            Questi elementi sono nel file ma non nel tuo archivio.
            Spunta quelli che vuoi aggiungere.
          </p>
          <div class="er-list">
            <label
              v-for="d in missingDecisions"
              :key="d.element.id"
              class="er-item"
              :class="{ 'er-item--checked': d.add }"
            >
              <input v-model="d.add" type="checkbox" class="er-checkbox" />
              <span class="er-item-name">{{ d.element.name }}</span>
              <span class="er-freq">{{ freqLabel(d.element.maxFrequencyPerWeek) }}</span>
            </label>
          </div>
        </div>

        <!-- Sezione: conflitti di frequenza -->
        <div v-if="conflictDecisions.length > 0" class="er-section">
          <strong class="er-section-title">
            ⚠️ {{ conflictDecisions.length }}
            {{ conflictDecisions.length === 1 ? 'conflitto' : 'conflitti' }} di frequenza
          </strong>
          <p class="er-section-desc">
            Questi elementi hanno lo stesso nome ma frequenza settimanale diversa.
          </p>
          <div
            v-for="d in conflictDecisions"
            :key="d.fileElementId"
            class="er-conflict"
          >
            <strong class="er-conflict-name">{{ d.fileElement.name }}</strong>
            <span class="er-conflict-freqs">
              tuo: {{ freqLabel(d.localElement.maxFrequencyPerWeek) }}
              &nbsp;·&nbsp;
              file: {{ freqLabel(d.fileElement.maxFrequencyPerWeek) }}
            </span>
            <div class="er-radio-group">
              <label class="er-radio">
                <input
                  v-model="d.resolution"
                  type="radio"
                  :name="`conflict-${d.fileElementId}`"
                  value="keep-local"
                />
                Tieni il tuo
              </label>
              <label class="er-radio">
                <input
                  v-model="d.resolution"
                  type="radio"
                  :name="`conflict-${d.fileElementId}`"
                  value="overwrite"
                />
                Usa la frequenza del file
              </label>
              <label class="er-radio">
                <input
                  v-model="d.resolution"
                  type="radio"
                  :name="`conflict-${d.fileElementId}`"
                  value="rename"
                />
                Aggiungi con nuovo nome
              </label>
              <input
                v-if="d.resolution === 'rename'"
                v-model="d.newName"
                type="text"
                class="er-rename-input"
                placeholder="Nuovo nome per l'elemento importato…"
                maxlength="80"
              />
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button
            class="btn-primary"
            :disabled="!canConfirmElementReview"
            @click="confirmElementReview"
          >
            ✅ Importa
          </button>
          <button
            class="btn-secondary"
            @click="importMode === 'granular' ? (step = 'granular-select') : (step = 'mode-select')"
          >
            ← Indietro
          </button>
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
  max-height: 280px;
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

/* ── Modalità import (T6.4) ── */
.mode-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.mode-option {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
  cursor: pointer;
  transition: border-color 0.15s;
}

.mode-option:has(input:checked) {
  border-color: #2244aa;
  background: #f4f6ff;
}

.mode-option input[type='radio'] {
  margin-top: 2px;
  flex-shrink: 0;
}

.mode-option-content {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.mode-option-desc {
  font-size: 0.82rem;
  color: #666;
  font-weight: 400;
}

/* ── Selezione granulare (T6.5) ── */
.granular-toolbar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
}

.separator {
  color: #ccc;
}

.link-btn {
  background: none;
  border: none;
  color: #2244aa;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.link-btn:hover {
  color: #1a3388;
}

.granular-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 280px;
  overflow-y: auto;
}

.granular-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid #e8e8e8;
  border-radius: 5px;
  padding: 0.4rem 0.6rem;
  cursor: pointer;
  font-size: 0.88rem;
  transition: background 0.1s;
}

.granular-item--checked {
  background: #f4f6ff;
  border-color: #aabbee;
}

.granular-checkbox {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.granular-label {
  flex: 1;
}

.granular-count {
  font-size: 0.78rem;
  color: #888;
  margin-left: 0.25rem;
}

/* ── Risoluzione elementi (T6.6) ── */
.er-section {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
}

.er-section-title {
  font-size: 0.9rem;
}

.er-section-desc {
  font-size: 0.82rem;
  color: #666;
  margin: 0;
}

.er-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 200px;
  overflow-y: auto;
}

.er-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  padding: 0.35rem 0.5rem;
  cursor: pointer;
  font-size: 0.88rem;
}

.er-item--checked {
  background: #f4f6ff;
  border-color: #aabbee;
}

.er-checkbox {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
}

.er-item-name {
  flex: 1;
}

.er-freq {
  font-size: 0.78rem;
  color: #888;
  white-space: nowrap;
}

.er-conflict {
  border: 1px solid #ffe0a0;
  background: #fffbf0;
  border-radius: 6px;
  padding: 0.5rem 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.er-conflict-name {
  font-size: 0.9rem;
}

.er-conflict-freqs {
  font-size: 0.78rem;
  color: #888;
}

.er-radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-top: 0.15rem;
}

.er-radio {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.er-radio input[type='radio'] {
  flex-shrink: 0;
}

.er-rename-input {
  margin-top: 0.25rem;
  padding: 0.3rem 0.5rem;
  border: 1px solid #bbb;
  border-radius: 4px;
  font-size: 0.85rem;
  width: 100%;
  box-sizing: border-box;
}

.er-rename-input:focus {
  outline: none;
  border-color: #2244aa;
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

.btn-primary:hover:not(:disabled) {
  background: #1a3388;
}

.btn-primary:disabled {
  background: #99aadd;
  cursor: not-allowed;
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
