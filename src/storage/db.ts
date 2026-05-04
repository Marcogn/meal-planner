import Dexie, { type Table } from 'dexie';
import type { Element, Week } from '../domain/types';

/**
 * Database IndexedDB dell'applicazione (nuovo schema — T1.4).
 *
 * Versione 1: due store
 *   - `elements`  indicizzati per `id`, `name`, `createdAt`
 *   - `weeks`     indicizzati per `id`, `updatedAt`
 *
 * NOTA: questo è separato dal DB legacy in `src/data/db.ts` che usa
 * il vecchio schema (dishes / meals / settings). Il nuovo DB ha un nome
 * diverso (`MenuPlannerV2`) per evitare conflitti.
 */
export class AppDB extends Dexie {
  elements!: Table<Element, string>;
  weeks!: Table<Week, string>;

  constructor() {
    super('MenuPlannerV2');

    this.version(1).stores({
      // Sintassi Dexie: prima stringa = indice primario, le altre = indici secondari
      elements: 'id, name, createdAt',
      weeks: 'id, updatedAt',
    });
  }
}

/** Singleton da importare nei layer storage. */
export const appDb = new AppDB();
