/**
 * Test CRUD src/storage/elements.ts
 *
 * Usa fake-indexeddb per simulare IndexedDB in jsdom senza browser reale.
 * Il DB viene ricreato per ogni test tramite beforeEach.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createElement,
  getAllElements,
  getElementById,
  updateElement,
  deleteElement,
  ElementValidationError,
} from '../elements';
import { appDb } from '../db';

beforeEach(async () => {
  // Svuota le tabelle tra i test per garantire isolamento
  await appDb.elements.clear();
});

// ---- Helpers ----

function makeData(
  name: string = 'formaggio',
  max: Parameters<typeof createElement>[0]['maxFrequencyPerWeek'] = 3,
) {
  return { name, maxFrequencyPerWeek: max } as const;
}

// ---- Test ----

describe('createElement', () => {
  it('crea un Elemento con i campi corretti', async () => {
    const el = await createElement(makeData('formaggio', 3));
    expect(el.id).toBeTypeOf('string');
    expect(el.name).toBe('formaggio');
    expect(el.maxFrequencyPerWeek).toBe(3);
    expect(el.createdAt).toBeGreaterThan(0);
    expect(el.updatedAt).toBe(el.createdAt);
  });

  it('persiste il record nel DB', async () => {
    const el = await createElement(makeData('carne rossa', 2));
    const found = await getElementById(el.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe('carne rossa');
  });

  it('trim del nome prima del salvataggio', async () => {
    const el = await createElement({ name: '  verdura  ', maxFrequencyPerWeek: 'unlimited' });
    expect(el.name).toBe('verdura');
  });

  it('lancia ElementValidationError se nome vuoto', async () => {
    await expect(createElement(makeData(''))).rejects.toThrow(ElementValidationError);
    await expect(createElement(makeData('   '))).rejects.toThrow(ElementValidationError);
  });

  it('lancia ElementValidationError per duplicato case-insensitive', async () => {
    await createElement(makeData('Pane'));
    await expect(createElement(makeData('pane'))).rejects.toThrow(ElementValidationError);
    await expect(createElement(makeData('PANE'))).rejects.toThrow(ElementValidationError);
  });

  it('crea Elementi con nomi diversi senza errori', async () => {
    await createElement(makeData('pasta'));
    await createElement(makeData('riso'));
    const all = await getAllElements();
    expect(all).toHaveLength(2);
  });
});

describe('getAllElements', () => {
  it('ritorna array vuoto se non ci sono Elementi', async () => {
    const all = await getAllElements();
    expect(all).toEqual([]);
  });

  it('ritorna tutti gli Elementi ordinati alfabeticamente', async () => {
    await createElement(makeData('verdura'));
    await createElement(makeData('pane'));
    await createElement(makeData('carne rossa'));
    const all = await getAllElements();
    expect(all.map((e) => e.name)).toEqual(['carne rossa', 'pane', 'verdura']);
  });
});

describe('getElementById', () => {
  it('ritorna undefined per id sconosciuto', async () => {
    const found = await getElementById('non-esiste');
    expect(found).toBeUndefined();
  });

  it("ritorna l'Elemento corretto per id noto", async () => {
    const el = await createElement(makeData('pesce', 3));
    const found = await getElementById(el.id);
    expect(found?.id).toBe(el.id);
    expect(found?.name).toBe('pesce');
  });
});

describe('updateElement', () => {
  it('aggiorna il nome', async () => {
    const el = await createElement(makeData('carne bianca', 3));
    const updated = await updateElement(el.id, { name: 'pollo' });
    expect(updated.name).toBe('pollo');
    expect(updated.id).toBe(el.id);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(el.updatedAt);
  });

  it('aggiorna la frequenza', async () => {
    const el = await createElement(makeData('riso', 2));
    const updated = await updateElement(el.id, { maxFrequencyPerWeek: 4 });
    expect(updated.maxFrequencyPerWeek).toBe(4);
  });

  it('aggiorna nome e frequenza insieme', async () => {
    const el = await createElement(makeData('pasta', 3));
    const updated = await updateElement(el.id, {
      name: 'pasta integrale',
      maxFrequencyPerWeek: 'unlimited',
    });
    expect(updated.name).toBe('pasta integrale');
    expect(updated.maxFrequencyPerWeek).toBe('unlimited');
  });

  it('lancia ElementValidationError per id inesistente', async () => {
    await expect(updateElement('id-fantasma', { name: 'x' })).rejects.toThrow(
      ElementValidationError,
    );
  });

  it('lancia ElementValidationError per nome vuoto', async () => {
    const el = await createElement(makeData('legumi'));
    await expect(updateElement(el.id, { name: '' })).rejects.toThrow(ElementValidationError);
  });

  it('lancia ElementValidationError per duplicato nome con altro Elemento', async () => {
    const el1 = await createElement(makeData('formaggio'));
    await createElement(makeData('pane'));
    await expect(updateElement(el1.id, { name: 'Pane' })).rejects.toThrow(ElementValidationError);
  });

  it('permette di aggiornare un Elemento con lo stesso nome (senza cambiare nome)', async () => {
    const el = await createElement(makeData('frutta'));
    // Non deve lanciare: il nome collide con se stesso, excludeId lo esclude
    const updated = await updateElement(el.id, { name: 'frutta', maxFrequencyPerWeek: 5 });
    expect(updated.maxFrequencyPerWeek).toBe(5);
  });
});

describe('deleteElement', () => {
  it('elimina un Elemento esistente', async () => {
    const el = await createElement(makeData('zucchero'));
    await deleteElement(el.id);
    const found = await getElementById(el.id);
    expect(found).toBeUndefined();
  });

  it("non lancia errore se l'id non esiste", async () => {
    await expect(deleteElement('id-inesistente')).resolves.toBeUndefined();
  });

  it('dopo delete, il nome è di nuovo disponibile per un nuovo Elemento', async () => {
    const el = await createElement(makeData('sale'));
    await deleteElement(el.id);
    const el2 = await createElement(makeData('sale'));
    expect(el2.id).not.toBe(el.id);
  });
});
