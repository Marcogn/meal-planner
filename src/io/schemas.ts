import { z } from 'zod';

const ProteinCategorySchema = z.enum([
  'CARNE_ROSSA',
  'CARNE_BIANCA',
  'PESCE',
  'LEGUMI',
  'UOVA',
  'FORMAGGIO',
  'CEREALI',
  'ALTRO',
]);

const MealSlotSchema = z.enum(['PRANZO', 'CENA']);

const DishSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  proteinCategories: z.array(ProteinCategorySchema),
  tags: z.array(z.string()),
  notes: z.string().optional(),
  createdAt: z.string(),
});

const MealSchema = z.object({
  id: z.string().uuid(),
  dishId: z.string().uuid(),
  date: z.string(),
  slot: MealSlotSchema,
});

const WeeklyMenuSchema = z.object({
  isoWeek: z.string(),
  meals: z.array(MealSchema),
});

const FrequencyConstraintSchema = z.object({
  category: ProteinCategorySchema,
  minPerWeek: z.number().int().nonnegative().optional(),
  maxPerWeek: z.number().int().positive().optional(),
});

const SettingsSchema = z.object({
  constraints: z.array(FrequencyConstraintSchema),
  recencyWindowWeeks: z.number().int().positive(),
});

export const SUPPORTED_SCHEMA_VERSION = 1 as const;

export const ExportSchema = z.object({
  schemaVersion: z.literal(SUPPORTED_SCHEMA_VERSION),
  exportedAt: z.string(),
  dishes: z.array(DishSchema),
  menus: z.array(WeeklyMenuSchema),
  settings: SettingsSchema,
});

export type ExportData = z.infer<typeof ExportSchema>;

export function parseExport(raw: unknown): ExportData {
  if (typeof raw === 'object' && raw !== null && 'schemaVersion' in raw) {
    const version = (raw as Record<string, unknown>).schemaVersion;
    if (version !== SUPPORTED_SCHEMA_VERSION) {
      throw new Error(
        `Versione schema non supportata: ${version}. Versione attesa: ${SUPPORTED_SCHEMA_VERSION}.`
      );
    }
  }
  return ExportSchema.parse(raw);
}
