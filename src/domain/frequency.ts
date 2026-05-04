import type { Element, FrequencyLimit, ID, Week } from './types';

export interface FrequencyEntry {
  used: number;
  max: FrequencyLimit;
  exceeded: boolean;
}

/**
 * Calcola le frequenze settimanali degli Elementi nella settimana `week`.
 *
 * Regole (da SPEC.md §4):
 * - Ogni Elemento conta 1 per ogni **piatto** in cui appare, indipendentemente
 *   dal pasto o dal giorno.
 * - Lo stesso Elemento ripetuto più volte dentro lo stesso piatto conta 1
 *   (dedup per piatto).
 * - `exceeded` è `true` solo quando `max !== 'unlimited'` e `used > max`.
 *
 * Ritorna una `Map` con una voce per **ogni** Elemento in `elements`,
 * più eventuali Elementi presenti nella settimana ma non più in `elements`
 * (caso limite: Elemento eliminato ma ancora nei piatti storici).
 */
export function computeWeeklyFrequencies(
  week: Week,
  elements: Element[],
): Map<ID, FrequencyEntry> {
  // Inizializza il contatore per ogni Elemento noto a 0
  const result = new Map<ID, FrequencyEntry>(
    elements.map((el) => [
      el.id,
      { used: 0, max: el.maxFrequencyPerWeek, exceeded: false },
    ]),
  );

  // Scansiona tutti i piatti della settimana
  for (const slot of week.slots) {
    for (const dish of slot.dishes) {
      // Dedup: lo stesso Elemento non conta più di 1 per piatto
      const uniqueElementIds = new Set(dish.elementIds);

      for (const elementId of uniqueElementIds) {
        if (result.has(elementId)) {
          const entry = result.get(elementId)!;
          const newUsed = entry.used + 1;
          result.set(elementId, {
            ...entry,
            used: newUsed,
            exceeded: entry.max !== 'unlimited' && newUsed > (entry.max as number),
          });
        } else {
          // Elemento non più in archivio ma ancora referenziato nei piatti storici.
          // Lo includiamo senza limite definito.
          const newUsed = (result.get(elementId)?.used ?? 0) + 1;
          result.set(elementId, {
            used: newUsed,
            max: 'unlimited',
            exceeded: false,
          });
        }
      }
    }
  }

  return result;
}
