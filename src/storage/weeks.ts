import { appDb } from './db';
import type { Dish, DayOfWeek, ID, MealSlot, MealType, Week } from '../domain/types';
import { weekIdToMonday } from '../domain/week';

// ---- Helpers interni ----

/** Formatta un oggetto Date UTC come stringa "YYYY-MM-DD". */
function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Costruisce una Week vuota per il weekId dato. */
function emptyWeek(weekId: string): Week {
  const monday = weekIdToMonday(weekId);
  return {
    id: weekId,
    isoWeekStart: formatDate(monday),
    slots: [],
    updatedAt: Date.now(),
  };
}

/** Trova o crea uno slot nella lista (ritorna l'array mutato e lo slot). */
function findOrCreateSlot(slots: MealSlot[], day: DayOfWeek, meal: MealType): MealSlot {
  let slot = slots.find((s) => s.day === day && s.meal === meal);
  if (!slot) {
    slot = { day, meal, dishes: [] };
    slots.push(slot);
  }
  return slot;
}

// ---- API pubblica ----

/** Ritorna la settimana con il dato weekId, o `undefined` se non esiste. */
export async function getWeek(weekId: string): Promise<Week | undefined> {
  return appDb.weeks.get(weekId);
}

/**
 * Ritorna la settimana con il dato weekId, creandola vuota se non esiste ancora.
 * Il weekId deve avere il formato "YYYY-Www" (es. "2026-W19").
 */
export async function getOrCreateWeek(weekId: string): Promise<Week> {
  const existing = await appDb.weeks.get(weekId);
  if (existing) return existing;
  const week = emptyWeek(weekId);
  await appDb.weeks.add(week);
  return week;
}

/**
 * Aggiunge un piatto a uno slot della settimana.
 * Se la settimana o lo slot non esistono vengono creati.
 * Il piatto viene aggiunto in coda ai piatti già presenti nello slot.
 * Ritorna la Week aggiornata.
 */
export async function addDishToSlot(
  weekId: string,
  day: DayOfWeek,
  meal: MealType,
  dish: Dish,
): Promise<Week> {
  const week = await getOrCreateWeek(weekId);
  // Lavoriamo su una copia per evitare mutazioni accidentali del record Dexie
  const slots: MealSlot[] = week.slots.map((s) => ({ ...s, dishes: [...s.dishes] }));
  const slot = findOrCreateSlot(slots, day, meal);
  slot.dishes.push(dish);
  const updated: Week = { ...week, slots, updatedAt: Date.now() };
  await appDb.weeks.put(updated);
  return updated;
}

/**
 * Rimuove un piatto (per `dishId`) da uno slot della settimana.
 * Non-op silenzioso se la settimana, lo slot o il piatto non esistono.
 * Ritorna la Week aggiornata (o quella non modificata se non trovata).
 */
export async function removeDishFromSlot(
  weekId: string,
  day: DayOfWeek,
  meal: MealType,
  dishId: ID,
): Promise<Week | undefined> {
  const week = await appDb.weeks.get(weekId);
  if (!week) return undefined;

  const slots: MealSlot[] = week.slots.map((s) => {
    if (s.day !== day || s.meal !== meal) return { ...s, dishes: [...s.dishes] };
    return { ...s, dishes: s.dishes.filter((d) => d.id !== dishId) };
  });

  const updated: Week = { ...week, slots, updatedAt: Date.now() };
  await appDb.weeks.put(updated);
  return updated;
}

/**
 * Conta quanti piatti (in tutte le settimane) referenziano `elementId`.
 * Usato per la conferma di eliminazione di un Elemento (T2.4).
 */
export async function countDishesUsingElement(elementId: ID): Promise<number> {
  const allWeeks = await appDb.weeks.toArray();
  let count = 0;
  for (const week of allWeeks) {
    for (const slot of week.slots) {
      for (const dish of slot.dishes) {
        if (dish.elementIds.includes(elementId)) count++;
      }
    }
  }
  return count;
}

/**
 * Rimuove `elementId` dalla lista `elementIds` di ogni piatto in tutte le settimane.
 * Chiamato quando si elimina un Elemento (T2.4 / cleanup).
 * I piatti restano (il nome rimane), perdono solo la referenza all'Elemento eliminato.
 */
export async function removeElementFromAllWeeks(elementId: ID): Promise<void> {
  const allWeeks = await appDb.weeks.toArray();
  const toUpdate: Week[] = [];

  for (const week of allWeeks) {
    let dirty = false;
    const slots: MealSlot[] = week.slots.map((s) => {
      const dishes = s.dishes.map((d) => {
        if (!d.elementIds.includes(elementId)) return d;
        dirty = true;
        return { ...d, elementIds: d.elementIds.filter((id) => id !== elementId) };
      });
      return { ...s, dishes };
    });
    if (dirty) {
      toUpdate.push({ ...week, slots, updatedAt: Date.now() });
    }
  }

  if (toUpdate.length > 0) {
    await appDb.weeks.bulkPut(toUpdate);
  }
}
