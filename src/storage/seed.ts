import { appDb } from './db';
import { createElement } from './elements';
import type { FrequencyLimit } from '../domain/types';

/** Elementi predefiniti come da TASKS.md T2.5. */
const DEFAULT_ELEMENTS: Array<{ name: string; maxFrequencyPerWeek: FrequencyLimit }> = [
  { name: 'pasta', maxFrequencyPerWeek: 3 },
  { name: 'riso', maxFrequencyPerWeek: 2 },
  { name: 'pane', maxFrequencyPerWeek: 'unlimited' },
  { name: 'formaggio', maxFrequencyPerWeek: 1 },
  { name: 'carne rossa', maxFrequencyPerWeek: 2 },
  { name: 'carne bianca', maxFrequencyPerWeek: 3 },
  { name: 'pesce', maxFrequencyPerWeek: 3 },
  { name: 'verdura', maxFrequencyPerWeek: 'unlimited' },
  { name: 'frutta', maxFrequencyPerWeek: 'unlimited' },
  { name: 'legumi', maxFrequencyPerWeek: 3 },
];

/**
 * Se il DB degli Elementi è vuoto (primo avvio), inserisce gli elementi
 * predefiniti. L'utente può modificarli o eliminarli liberamente in seguito.
 */
export async function seedElementsIfEmpty(): Promise<void> {
  const count = await appDb.elements.count();
  if (count > 0) return;
  for (const el of DEFAULT_ELEMENTS) {
    await createElement(el);
  }
}
