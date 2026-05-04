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

// ---- Export ----

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
