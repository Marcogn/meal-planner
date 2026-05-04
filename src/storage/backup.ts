import { z } from 'zod';
import { appDb } from './db';
import type { Element, Week } from '../domain/types';

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
 * Ritorna un Set di ID univoci.
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

// ---- Import ----

/**
 * Legge il file JSON, valida formato e schema, poi sovrascrive atomicamente
 * il DB (elementi + settimane) con i dati del backup.
 *
 * Lancia `BackupImportError` con un messaggio localizzato in italiano in caso
 * di errore di lettura, formato sconosciuto, versione non supportata o schema non valido.
 */
export async function importAll(file: File): Promise<void> {
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
    const detail = first ? `${first.path.join('.') || 'radice'}: ${first.message}` : 'errore sconosciuto';
    throw new BackupImportError(`Schema non valido — ${detail}.`);
  }
  const data = result.data;

  // 6. Sovrascrittura atomica
  await appDb.transaction('rw', [appDb.elements, appDb.weeks], async () => {
    await appDb.elements.clear();
    await appDb.weeks.clear();
    if (data.elements.length > 0) {
      await appDb.elements.bulkAdd(data.elements as Element[]);
    }
    if (data.weeks.length > 0) {
      await appDb.weeks.bulkAdd(data.weeks as Week[]);
    }
  });
}
