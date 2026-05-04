/**
 * Test src/storage/backup.ts
 *
 * Usa fake-indexeddb per simulare IndexedDB senza browser reale.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { exportAll, BACKUP_FORMAT, BACKUP_VERSION, type BackupData } from '../backup';
import { appDb } from '../db';
import { createElement } from '../elements';
import { addDishToSlot } from '../weeks';
import { v4 as uuidv4 } from 'uuid';

beforeEach(async () => {
  await appDb.elements.clear();
  await appDb.weeks.clear();
});

// ---- Helpers ----

async function parseBlob(blob: Blob): Promise<BackupData> {
  const text = await blob.text();
  return JSON.parse(text) as BackupData;
}

// ---- Test ----

describe('exportAll', () => {
  it('ritorna un Blob di tipo application/json', async () => {
    const blob = await exportAll();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/json');
  });

  it('il JSON contiene i campi obbligatori del formato backup', async () => {
    const data = await parseBlob(await exportAll());
    expect(data.format).toBe(BACKUP_FORMAT);
    expect(data.version).toBe(BACKUP_VERSION);
    expect(typeof data.exportedAt).toBe('string');
    expect(Array.isArray(data.elements)).toBe(true);
    expect(Array.isArray(data.weeks)).toBe(true);
  });

  it('exportedAt è una data ISO 8601 valida', async () => {
    const data = await parseBlob(await exportAll());
    const d = new Date(data.exportedAt);
    expect(isNaN(d.getTime())).toBe(false);
  });

  it('DB vuoto → elements e weeks sono array vuoti', async () => {
    const data = await parseBlob(await exportAll());
    expect(data.elements).toEqual([]);
    expect(data.weeks).toEqual([]);
  });

  it('esporta gli Elementi presenti nel DB', async () => {
    const el1 = await createElement({ name: 'formaggio', maxFrequencyPerWeek: 1 });
    const el2 = await createElement({ name: 'verdura', maxFrequencyPerWeek: 'unlimited' });
    const data = await parseBlob(await exportAll());
    expect(data.elements).toHaveLength(2);
    const ids = data.elements.map((e) => e.id);
    expect(ids).toContain(el1.id);
    expect(ids).toContain(el2.id);
  });

  it('esporta le Settimane presenti nel DB', async () => {
    const dish = { id: uuidv4(), name: 'pasta al pomodoro', elementIds: [] };
    await addDishToSlot('2026-W19', 1, 'pranzo', dish);
    const data = await parseBlob(await exportAll());
    expect(data.weeks).toHaveLength(1);
    expect(data.weeks[0].id).toBe('2026-W19');
  });

  it('esporta elementi e settimane insieme con integrità', async () => {
    const el = await createElement({ name: 'carne rossa', maxFrequencyPerWeek: 2 });
    const dish = { id: uuidv4(), name: 'bistecca', elementIds: [el.id] };
    await addDishToSlot('2026-W19', 2, 'cena', dish);

    const data = await parseBlob(await exportAll());
    expect(data.elements).toHaveLength(1);
    expect(data.weeks).toHaveLength(1);

    const exportedEl = data.elements[0];
    expect(exportedEl.name).toBe('carne rossa');
    expect(exportedEl.maxFrequencyPerWeek).toBe(2);

    const exportedWeek = data.weeks[0];
    const slot = exportedWeek.slots.find((s) => s.day === 2 && s.meal === 'cena');
    expect(slot).toBeDefined();
    expect(slot?.dishes[0].elementIds).toContain(el.id);
  });
});
