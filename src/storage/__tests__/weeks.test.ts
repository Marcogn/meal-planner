/**
 * Test CRUD src/storage/weeks.ts
 *
 * Usa fake-indexeddb per simulare IndexedDB in jsdom.
 * Le tabelle vengono svuotate tra i test via beforeEach.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWeek,
  getOrCreateWeek,
  addDishToSlot,
  removeDishFromSlot,
  removeElementFromAllWeeks,
} from '../weeks';
import { appDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import type { Dish } from '../../domain/types';

beforeEach(async () => {
  await appDb.weeks.clear();
});

// ---- Helpers ----

function makeDish(name: string, ...elementIds: string[]): Dish {
  return { id: uuidv4(), name, elementIds };
}

// ---- getWeek ----

describe('getWeek', () => {
  it('ritorna undefined per un weekId inesistente', async () => {
    expect(await getWeek('2026-W99')).toBeUndefined();
  });

  it('ritorna la settimana dopo che è stata creata', async () => {
    await getOrCreateWeek('2026-W19');
    const w = await getWeek('2026-W19');
    expect(w).toBeDefined();
    expect(w?.id).toBe('2026-W19');
  });
});

// ---- getOrCreateWeek ----

describe('getOrCreateWeek', () => {
  it('crea una Week vuota con i campi corretti', async () => {
    const w = await getOrCreateWeek('2026-W19');
    expect(w.id).toBe('2026-W19');
    expect(w.slots).toEqual([]);
    expect(w.updatedAt).toBeGreaterThan(0);
    // Lunedì della settimana 19 del 2026 è il 04/05/2026
    expect(w.isoWeekStart).toBe('2026-05-04');
  });

  it('ritorna la Week esistente senza ricrearne una nuova', async () => {
    const w1 = await getOrCreateWeek('2026-W19');
    const w2 = await getOrCreateWeek('2026-W19');
    expect(w2.id).toBe(w1.id);
    // Deve esserci un solo record nel DB
    expect(await appDb.weeks.count()).toBe(1);
  });

  it('gestisce la settimana ISO 53 (cambio anno)', async () => {
    // 2020-W53 esiste (lunedì 28/12/2020)
    const w = await getOrCreateWeek('2020-W53');
    expect(w.id).toBe('2020-W53');
    expect(w.isoWeekStart).toBe('2020-12-28');
  });
});

// ---- addDishToSlot ----

describe('addDishToSlot', () => {
  it('aggiunge un piatto a uno slot vuoto, creando la settimana', async () => {
    const dish = makeDish('pasta al pomodoro', 'elem-1');
    const w = await addDishToSlot('2026-W20', 1, 'pranzo', dish);
    expect(w.slots).toHaveLength(1);
    expect(w.slots[0].day).toBe(1);
    expect(w.slots[0].meal).toBe('pranzo');
    expect(w.slots[0].dishes).toHaveLength(1);
    expect(w.slots[0].dishes[0].name).toBe('pasta al pomodoro');
  });

  it('aggiunge più piatti allo stesso slot (tipicamente uno, ma ammesso)', async () => {
    const d1 = makeDish('risotto', 'elem-riso');
    const d2 = makeDish('insalata', 'elem-verdura');
    await addDishToSlot('2026-W20', 1, 'pranzo', d1);
    const w = await addDishToSlot('2026-W20', 1, 'pranzo', d2);
    expect(w.slots[0].dishes).toHaveLength(2);
  });

  it('aggiunge piatti a slot diversi nella stessa settimana', async () => {
    const d1 = makeDish('cena lunedì', 'elem-1');
    const d2 = makeDish('pranzo martedì', 'elem-2');
    await addDishToSlot('2026-W20', 1, 'cena', d1);
    const w = await addDishToSlot('2026-W20', 2, 'pranzo', d2);
    expect(w.slots).toHaveLength(2);
  });

  it('persiste correttamente nel DB', async () => {
    const dish = makeDish('pizza', 'elem-farina');
    await addDishToSlot('2026-W21', 5, 'cena', dish);
    const stored = await getWeek('2026-W21');
    expect(stored?.slots[0].dishes[0].name).toBe('pizza');
  });
});

// ---- removeDishFromSlot ----

describe('removeDishFromSlot', () => {
  it('rimuove il piatto corretto dallo slot', async () => {
    const d1 = makeDish('primo', 'e1');
    const d2 = makeDish('secondo', 'e2');
    await addDishToSlot('2026-W22', 3, 'pranzo', d1);
    await addDishToSlot('2026-W22', 3, 'pranzo', d2);
    const w = await removeDishFromSlot('2026-W22', 3, 'pranzo', d1.id);
    expect(w?.slots[0].dishes).toHaveLength(1);
    expect(w?.slots[0].dishes[0].id).toBe(d2.id);
  });

  it('ritorna undefined se la settimana non esiste', async () => {
    const result = await removeDishFromSlot('2026-W99', 1, 'pranzo', 'no-dish');
    expect(result).toBeUndefined();
  });

  it('non lancia errore se lo slot o il piatto non esistono', async () => {
    await getOrCreateWeek('2026-W23');
    // Slot inesistente → la week viene put senza slot modificati
    await expect(
      removeDishFromSlot('2026-W23', 7, 'cena', 'non-existent'),
    ).resolves.toBeDefined();
  });

  it('persiste la rimozione nel DB', async () => {
    const dish = makeDish('torta', 'e-dolce');
    await addDishToSlot('2026-W24', 6, 'colazione', dish);
    await removeDishFromSlot('2026-W24', 6, 'colazione', dish.id);
    const stored = await getWeek('2026-W24');
    expect(stored?.slots[0].dishes).toHaveLength(0);
  });
});

// ---- removeElementFromAllWeeks ----

describe('removeElementFromAllWeeks', () => {
  it('rimuove elementId da tutti i piatti di tutte le settimane', async () => {
    const elemId = uuidv4();
    const d1 = makeDish('pasta con formaggio', elemId, 'elem-pasta');
    const d2 = makeDish('pizza con formaggio', elemId, 'elem-farina');
    const d3 = makeDish('insalata senza formaggio', 'elem-verdura');
    await addDishToSlot('2026-W25', 1, 'pranzo', d1);
    await addDishToSlot('2026-W26', 2, 'cena', d2);
    await addDishToSlot('2026-W25', 2, 'pranzo', d3);

    await removeElementFromAllWeeks(elemId);

    const w25 = await getWeek('2026-W25');
    const w26 = await getWeek('2026-W26');

    // d1: deve aver perso elemId ma mantenuto elem-pasta
    const dish1 = w25?.slots.find((s) => s.day === 1 && s.meal === 'pranzo')?.dishes[0];
    expect(dish1?.elementIds).not.toContain(elemId);
    expect(dish1?.elementIds).toContain('elem-pasta');
    expect(dish1?.name).toBe('pasta con formaggio'); // nome invariato

    // d2: deve aver perso elemId ma mantenuto elem-farina
    const dish2 = w26?.slots[0].dishes[0];
    expect(dish2?.elementIds).not.toContain(elemId);
    expect(dish2?.elementIds).toContain('elem-farina');

    // d3: non conteneva elemId, invariato
    const dish3 = w25?.slots.find((s) => s.day === 2 && s.meal === 'pranzo')?.dishes[0];
    expect(dish3?.elementIds).toEqual(['elem-verdura']);
  });

  it('non-op se nessun piatto contiene quell\'elementId', async () => {
    const d = makeDish('riso e verdura', 'elem-riso');
    await addDishToSlot('2026-W27', 1, 'pranzo', d);
    await removeElementFromAllWeeks('elem-inesistente');
    const w = await getWeek('2026-W27');
    expect(w?.slots[0].dishes[0].elementIds).toEqual(['elem-riso']);
  });

  it('non-op se non ci sono settimane in DB', async () => {
    await expect(removeElementFromAllWeeks('qualsiasi')).resolves.toBeUndefined();
  });
});
