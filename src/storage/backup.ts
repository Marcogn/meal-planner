import { z } from 'zod';
import { appDb } from './db';
import type { DayOfWeek, Element, MealType, Week } from '../domain/types';

// ---- Tipi del formato backup ----

export const BACKUP_FORMAT = 'meal-planner-export' as const;
export const BACKUP_VERSION = 1 as const;

export interface BackupData {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string; // ISO 8601
  elements: Element[];
  weeks: Week[];
}

// ---- Errori ----

export class BackupImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupImportError';
  }
}

// ---- Schema Zod per validazione import ----

const FrequencyLimitSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal('unlimited'),
]);

const ElementSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  maxFrequencyPerWeek: FrequencyLimitSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
});

const DishSchema = z.object({
  id: z.string(),
  name: z.string(),
  elementIds: z.array(z.string()),
});

const MealTypeSchema = z.enum([
  'colazione',
  'merenda_mattina',
  'pranzo',
  'merenda_pomeriggio',
  'cena',
]);

const DayOfWeekSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
]);

const MealSlotSchema = z.object({
  day: DayOfWeekSchema,
  meal: MealTypeSchema,
  dishes: z.array(DishSchema),
});

const WeekSchema = z.object({
  id: z.string(),
  isoWeekStart: z.string(),
  slots: z.array(MealSlotSchema),
  updatedAt: z.number(),
});

export const BackupDataSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  elements: z.array(ElementSchema),
  weeks: z.array(WeekSchema),
});

// ---- Export ----

/**
 * Raccoglie tutti gli elementId referenziati dai piatti nelle settimane date.
 *
 * @param weeks - Array di settimane da analizzare.
 * @returns Un Set di ID univoci referenziati dai piatti.
 */
function collectReferencedElementIds(weeks: Week[]): Set<string> {
  const ids = new Set<string>();
  for (const week of weeks) {
    for (const slot of week.slots) {
      for (const dish of slot.dishes) {
        for (const id of dish.elementIds) {
          ids.add(id);
        }
      }
    }
  }
  return ids;
}

/**
 * Esporta le settimane indicate (per weekId) con **solo** gli Elementi
 * referenziati dai piatti in quelle settimane. Le settimane non presenti nel
 * DB vengono silenziosamente ignorate.
 *
 * Usato per la condivisione di menù (T6.1 / T6.2). Il formato del Blob
 * è lo stesso del backup completo (`BackupData`), quindi l'import
 * funziona con le stesse funzioni di validazione.
 */
export async function exportWeeks(weekIds: string[]): Promise<Blob> {
  // 1. Leggi solo le settimane richieste (ignora quelle non nel DB)
  const weeks = (
    await Promise.all(weekIds.map((id) => appDb.weeks.get(id)))
  ).filter((w): w is Week => w !== undefined);

  // 2. Raccogli gli element ID referenziati
  const referencedIds = collectReferencedElementIds(weeks);

  // 3. Leggi dal DB solo gli Elementi effettivamente referenziati
  const elements =
    referencedIds.size > 0
      ? await appDb.elements.where('id').anyOf([...referencedIds]).toArray()
      : [];

  const data: BackupData = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    elements,
    weeks,
  };

  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

/**
 * Esporta una singola settimana. Wrapper di `exportWeeks` per comodità.
 */
export async function exportWeek(weekId: string): Promise<Blob> {
  return exportWeeks([weekId]);
}

/**
 * Legge tutti gli Elementi e le Settimane dal DB e ritorna un Blob JSON
 * nel formato backup `{ format, version, exportedAt, elements, weeks }`.
 */
export async function exportAll(): Promise<Blob> {
  const [elements, weeks] = await Promise.all([
    appDb.elements.toArray(),
    appDb.weeks.toArray(),
  ]);

  const data: BackupData = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    elements,
    weeks,
  };

  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

// ---- Import (helpers) ----

/**
 * Legge un `File`, esegue il parse JSON e la validazione Zod, e ritorna il
 * `BackupData` validato senza scrivere nulla nel DB.
 *
 * Estratto come helper privato per essere condiviso tra `importAll` (backup)
 * e `parseSharedFile` (condivisione menù, T6.3).
 *
 * Lancia `BackupImportError` con messaggio localizzato in caso di:
 * - errore di lettura
 * - JSON malformato
 * - formato o versione non riconosciuti
 * - schema Zod non valido
 */
async function readAndValidate(file: File): Promise<BackupData> {
  // 1. Lettura del file
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new BackupImportError('Impossibile leggere il file.');
  }

  // 2. Parse JSON
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupImportError('File non valido: il contenuto non è JSON valido.');
  }

  // 3. Verifica formato
  if (typeof raw !== 'object' || raw === null) {
    throw new BackupImportError('Formato file non riconosciuto.');
  }
  const obj = raw as Record<string, unknown>;
  if (obj['format'] !== BACKUP_FORMAT) {
    throw new BackupImportError(`Formato file non riconosciuto (atteso: "${BACKUP_FORMAT}").`);
  }

  // 4. Verifica versione
  if (obj['version'] !== BACKUP_VERSION) {
    throw new BackupImportError(
      `Versione backup non supportata: ${obj['version']}. Versione attesa: ${BACKUP_VERSION}.`,
    );
  }

  // 5. Validazione schema Zod
  const result = BackupDataSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const detail = first
      ? `${first.path.join('.') || 'radice'}: ${first.message}`
      : 'errore sconosciuto';
    throw new BackupImportError(`Schema non valido — ${detail}.`);
  }

  return result.data;
}

// ---- Tipi per l'import condiviso ----

/** Modalità di importazione del menù condiviso. */
export type ImportMode = 'overwrite' | 'granular';

/** Identifica univocamente uno slot (settimana + giorno + pasto). */
export interface SlotKey {
  weekId: string;
  day: DayOfWeek;
  meal: MealType;
}

// T6.6 — Analisi e risoluzione degli Elementi durante l'import condiviso

/**
 * Un conflitto di nome: un Elemento del file e uno locale hanno lo stesso nome
 * (case-insensitive) ma `maxFrequencyPerWeek` diversa.
 */
export interface ConflictInfo {
  fileElement: Element;
  localElement: Element;
}

/**
 * Risultato dell'analisi degli Elementi nel file rispetto al DB locale.
 *
 * - `missing`: presenti nel file, assenti nel DB locale sia per ID che per nome.
 * - `conflicts`: stesso nome locale ma frequenza diversa.
 * - `autoRemap`: stesso nome + stessa frequenza ma ID diverso → rimappatura
 *   automatica senza richiedere azione all'utente.
 */
export interface ElementImportAnalysis {
  missing: Element[];
  conflicts: ConflictInfo[];
  autoRemap: Map<string, string>; // fileElementId → localElementId
}

/**
 * Risoluzione per un singolo conflitto di nome.
 *
 * - `keep-local`: mantieni il tuo elemento (le dish importate vengono rimappate
 *   al localElement.id).
 * - `overwrite`: aggiorna la frequenza del tuo elemento al valore del file
 *   (le dish importate vengono rimappate al localElement.id).
 * - `rename`: aggiungi l'elemento del file con un nuovo nome (le dish importate
 *   usano il fileElement.id, che verrà inserito nel DB con il nuovo nome).
 */
export interface ConflictDecision {
  fileElementId: string;
  resolution: 'keep-local' | 'overwrite' | 'rename';
  /** Obbligatorio quando `resolution === 'rename'`. */
  newName?: string;
}

/** Decisioni dell'utente per la gestione degli Elementi durante l'import. */
export interface ElementImportDecisions {
  /** Subset di `ElementImportAnalysis.missing[].id` che l'utente vuole aggiungere. */
  addMissingIds: string[];
  /** Una decisione per ogni conflitto. */
  conflicts: ConflictDecision[];
}

/** Suffisso aggiunto al nome di un elemento importato con risoluzione 'rename'. */
const RENAME_SUFFIX = ' (importato)';

// ---- Import (API pubblica) ----

/**
 * Analizza gli Elementi del file rispetto al DB locale e li classifica in:
 * - `missing`: nel file, non trovati nel DB né per ID né per nome.
 * - `conflicts`: stesso nome ma `maxFrequencyPerWeek` diversa.
 * - `autoRemap`: stesso nome + stessa frequenza ma ID diverso
 *   (rimappatura automatica, non richiede azione utente).
 */
export async function analyzeElementImport(
  data: BackupData,
): Promise<ElementImportAnalysis> {
  const localElements = await appDb.elements.toArray();
  const localById = new Map(localElements.map((e) => [e.id, e]));
  const localByName = new Map(
    localElements.map((e) => [e.name.toLowerCase().trim(), e]),
  );

  const missing: Element[] = [];
  const conflicts: ConflictInfo[] = [];
  const autoRemap = new Map<string, string>();

  for (const fileEl of data.elements) {
    // Già presente per ID → nessun problema
    if (localById.has(fileEl.id)) continue;

    const localMatch = localByName.get(fileEl.name.toLowerCase().trim());

    if (!localMatch) {
      // Nessun match per nome → mancante
      missing.push(fileEl);
    } else if (localMatch.maxFrequencyPerWeek !== fileEl.maxFrequencyPerWeek) {
      // Stesso nome, frequenza diversa → conflitto
      conflicts.push({ fileElement: fileEl, localElement: localMatch });
    } else {
      // Stesso nome + stessa frequenza + ID diverso → auto-remap silenzioso
      autoRemap.set(fileEl.id, localMatch.id);
    }
  }

  return { missing, conflicts, autoRemap };
}

/**
 * Applica le decisioni dell'utente per la gestione degli Elementi mancanti e
 * conflittuali.
 *
 * - Scrive nel DB gli elementi da aggiungere/aggiornare.
 * - Costruisce la mappa di rimappatura ID (fileId → localId) partendo
 *   dall'`autoRemap` e dalle decisioni di conflitto.
 * - Ritorna una copia del `BackupData` con gli `elementIds` delle dishes
 *   rimappati, pronta per essere passata a `importWeeks`.
 *
 * È sicuro chiamare questa funzione anche con `decisions` vuote (es. quando
 * `missing` e `conflicts` sono entrambi vuoti): viene applicata solo la
 * rimappatura automatica.
 */
export async function applyElementDecisions(
  data: BackupData,
  analysis: ElementImportAnalysis,
  decisions: ElementImportDecisions,
): Promise<BackupData> {
  const now = Date.now();
  // Mappa finale: fileElementId → localElementId
  const idRemap = new Map<string, string>(analysis.autoRemap);

  // Gestisci elementi mancanti
  const addSet = new Set(decisions.addMissingIds);
  for (const el of analysis.missing) {
    if (addSet.has(el.id)) {
      // Aggiungi con l'ID del file: le dish references funzionano senza remap
      await appDb.elements.put({ ...el, updatedAt: now });
    }
    // Se non aggiunto: le dish references puntano a un ID inesistente →
    // mostrato come "(eliminato)" nell'UI — comportamento atteso per T2.4.
  }

  // Gestisci conflitti
  for (const dec of decisions.conflicts) {
    const conflict = analysis.conflicts.find(
      (c) => c.fileElement.id === dec.fileElementId,
    );
    if (!conflict) continue;

    switch (dec.resolution) {
      case 'keep-local':
        // Rimappa le dish al localElement.id (non toccare il DB)
        idRemap.set(dec.fileElementId, conflict.localElement.id);
        break;

      case 'overwrite':
        // Aggiorna la frequenza dell'elemento locale
        await appDb.elements.put({
          ...conflict.localElement,
          maxFrequencyPerWeek: conflict.fileElement.maxFrequencyPerWeek,
          updatedAt: now,
        });
        // Rimappa al localElement.id (stesso elemento, frequenza aggiornata)
        idRemap.set(dec.fileElementId, conflict.localElement.id);
        break;

      case 'rename': {
        // Aggiungi l'elemento con il nuovo nome usando l'ID del file
        const newName = dec.newName?.trim() ?? `${conflict.fileElement.name}${RENAME_SUFFIX}`;
        await appDb.elements.put({ ...conflict.fileElement, name: newName, updatedAt: now });
        // Nessuna rimappatura: l'ID del file viene inserito direttamente
        break;
      }
    }
  }

  // Se non ci sono rimappature, ritorna data invariato
  if (idRemap.size === 0) return data;

  // Applica la rimappatura agli elementIds delle dishes
  const remappedWeeks: Week[] = data.weeks.map((week) => ({
    ...week,
    slots: week.slots.map((slot) => ({
      ...slot,
      dishes: slot.dishes.map((dish) => ({
        ...dish,
        elementIds: dish.elementIds.map((id) => idRemap.get(id) ?? id),
      })),
    })),
  }));

  return { ...data, weeks: remappedWeeks };
}

/**
 * Valida un file di condivisione o backup **senza** scrivere nel DB.
 * Usato per mostrare l'anteprima del menù ricevuto prima di decidere
 * come importarlo (T6.3).
 *
 * Lancia `BackupImportError` se il file non è valido.
 */
export async function parseSharedFile(file: File): Promise<BackupData> {
  return readAndValidate(file);
}

/**
 * Legge il file JSON, valida formato e schema, poi importa i dati del backup:
 *
 * - **Elementi**: strategia di merge. Gli elementi già presenti vengono
 *   aggiornati (compresa la frequenza massima); gli elementi presenti solo nel
 *   backup vengono aggiunti; gli elementi locali non presenti nel backup restano
 *   invariati.
 * - **Settimane**: sostituzione completa (solo le settimane nel file vengono
 *   toccate; il resto rimane invariato nel DB).
 *
 * Lancia `BackupImportError` con un messaggio localizzato in italiano in caso
 * di errore di lettura, formato sconosciuto, versione non supportata o schema non valido.
 */
export async function importAll(file: File): Promise<void> {
  const data = await readAndValidate(file);

  await appDb.transaction('rw', [appDb.elements, appDb.weeks], async () => {
    // Elementi: upsert (aggiorna esistenti, aggiunge nuovi, lascia gli altri)
    if (data.elements.length > 0) {
      await appDb.elements.bulkPut(data.elements as Element[]);
    }
    // Settimane: sostituzione completa delle settimane presenti nel file
    if (data.weeks.length > 0) {
      await appDb.weeks.bulkPut(data.weeks as Week[]);
    }
  });
}

/**
 * Importa le settimane da `data` nel DB locale.
 *
 * - `overwrite`: sostituisce interamente ogni settimana presente nel file
 *   (solo le settimane nel file vengono toccate; le altre restano invariate).
 * - `granular`: importa solo gli slot indicati in `selectedSlots`.
 *   Per ogni slot selezionato, i piatti del file sostituiscono quelli locali
 *   per quello slot specifico. Se la settimana locale non esiste, viene creata.
 *
 * Gli Elementi nel file NON vengono toccati (gestiti in T6.6).
 */
export async function importWeeks(
  data: BackupData,
  mode: ImportMode,
  selectedSlots: SlotKey[] = [],
): Promise<void> {
  if (mode === 'overwrite') {
    if (data.weeks.length > 0) {
      await appDb.weeks.bulkPut(data.weeks as Week[]);
    }
    return;
  }

  // Modalità granulare: nessuno slot selezionato → nessuna scrittura
  if (selectedSlots.length === 0) return;

  // Raggruppa gli slot per weekId per minimizzare le letture DB
  const byWeek = new Map<string, SlotKey[]>();
  for (const sk of selectedSlots) {
    const list = byWeek.get(sk.weekId) ?? [];
    list.push(sk);
    byWeek.set(sk.weekId, list);
  }

  for (const [weekId, weekSlots] of byWeek) {
    const fileWeek = data.weeks.find((w) => w.id === weekId);
    if (!fileWeek) continue;

    // Ottieni la settimana locale o creane una nuova con i metadati del file
    const localWeek: Week = (await appDb.weeks.get(weekId)) ?? {
      id: weekId,
      isoWeekStart: fileWeek.isoWeekStart,
      slots: [],
      updatedAt: Date.now(),
    };

    // Copia gli slot (evita mutazioni del record Dexie)
    const slots: Week['slots'] = localWeek.slots.map((s) => ({
      ...s,
      dishes: [...s.dishes],
    }));

    for (const sk of weekSlots) {
      const fileSlot = fileWeek.slots.find((s) => s.day === sk.day && s.meal === sk.meal);
      if (!fileSlot) continue;

      // Rimuovi eventuale slot locale per questo (giorno, pasto)
      const idx = slots.findIndex((s) => s.day === sk.day && s.meal === sk.meal);
      if (idx >= 0) slots.splice(idx, 1);

      // Aggiungi lo slot dal file (anche se vuoto, per sovrascrivere)
      slots.push({ day: sk.day, meal: sk.meal, dishes: [...fileSlot.dishes] });
    }

    const updated: Week = { ...localWeek, slots, updatedAt: Date.now() };
    await appDb.weeks.put(updated);
  }
}
