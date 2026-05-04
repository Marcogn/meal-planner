import { appDb } from './db';
import type { Element, ID } from '../domain/types';
import { v4 as uuidv4 } from 'uuid';

// ---- Errori di validazione ----

export class ElementValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ElementValidationError';
  }
}

// ---- Validazione interna ----

/**
 * Lancia `ElementValidationError` se il nome è vuoto o se esiste già
 * un Elemento con lo stesso nome (case-insensitive), escludendo l'id
 * `excludeId` (usato nell'update per escludere l'Elemento stesso).
 */
async function validateName(name: string, excludeId?: ID): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new ElementValidationError('Il nome non può essere vuoto.');
  }
  const lower = trimmed.toLowerCase();
  const all = await appDb.elements.toArray();
  const duplicate = all.find(
    (el) => el.name.trim().toLowerCase() === lower && el.id !== excludeId,
  );
  if (duplicate) {
    throw new ElementValidationError(
      `Esiste già un Elemento con il nome "${duplicate.name}".`,
    );
  }
}

// ---- CRUD ----

/** Crea un nuovo Elemento e lo persiste. Ritorna l'Elemento creato. */
export async function createElement(
  data: Pick<Element, 'name' | 'maxFrequencyPerWeek'>,
): Promise<Element> {
  await validateName(data.name);
  const now = Date.now();
  const element: Element = {
    id: uuidv4(),
    name: data.name.trim(),
    maxFrequencyPerWeek: data.maxFrequencyPerWeek,
    createdAt: now,
    updatedAt: now,
  };
  await appDb.elements.add(element);
  return element;
}

/** Ritorna tutti gli Elementi, ordinati alfabeticamente per nome. */
export async function getAllElements(): Promise<Element[]> {
  const all = await appDb.elements.toArray();
  return all.sort((a, b) => a.name.localeCompare(b.name, 'it'));
}

/** Ritorna un Elemento per ID, o `undefined` se non esiste. */
export async function getElementById(id: ID): Promise<Element | undefined> {
  return appDb.elements.get(id);
}

/** Aggiorna nome e/o frequenza di un Elemento esistente. Ritorna l'Elemento aggiornato. */
export async function updateElement(
  id: ID,
  data: Partial<Pick<Element, 'name' | 'maxFrequencyPerWeek'>>,
): Promise<Element> {
  const existing = await appDb.elements.get(id);
  if (!existing) {
    throw new ElementValidationError(`Elemento con id "${id}" non trovato.`);
  }
  if (data.name !== undefined) {
    await validateName(data.name, id);
  }
  const updated: Element = {
    ...existing,
    ...(data.name !== undefined ? { name: data.name.trim() } : {}),
    ...(data.maxFrequencyPerWeek !== undefined
      ? { maxFrequencyPerWeek: data.maxFrequencyPerWeek }
      : {}),
    updatedAt: Date.now(),
  };
  await appDb.elements.put(updated);
  return updated;
}

/** Elimina un Elemento per ID. Nessun errore se non esiste. */
export async function deleteElement(id: ID): Promise<void> {
  await appDb.elements.delete(id);
}
