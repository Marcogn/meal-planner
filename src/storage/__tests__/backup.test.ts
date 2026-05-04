/**
 * Test src/storage/backup.ts
 *
 * Usa fake-indexeddb per simulare IndexedDB senza browser reale.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  exportAll,
  exportWeek,
  exportWeeks,
  importAll,
  importWeeks,
  analyzeElementImport,
  applyElementDecisions,
  BackupImportError,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupData,
  type SlotKey,
  type ElementImportDecisions,
} from '../backup';
import { appDb } from '../db';
import { createElement, getAllElements, getElementById } from '../elements';
import { addDishToSlot, getWeek } from '../weeks';
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

function makeValidBackup(overrides: Partial<BackupData> = {}): BackupData {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    elements: [],
    weeks: [],
    ...overrides,
  };
}

function makeFile(content: string, name = 'backup.json'): File {
  return new File([content], name, { type: 'application/json' });
}

// ---- Test exportAll ----

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

// ---- Test importAll ----

describe('importAll', () => {
  it('importa un backup valido e popola il DB', async () => {
    const backup = makeValidBackup({
      elements: [
        { id: 'el-1', name: 'formaggio', maxFrequencyPerWeek: 2, createdAt: 1000, updatedAt: 1000 },
      ],
      weeks: [
        {
          id: '2026-W19',
          isoWeekStart: '2026-05-04',
          slots: [{ day: 1, meal: 'pranzo', dishes: [{ id: 'd-1', name: 'pasta', elementIds: ['el-1'] }] }],
          updatedAt: 2000,
        },
      ],
    });
    await importAll(makeFile(JSON.stringify(backup)));
    const elements = await getAllElements();
    expect(elements).toHaveLength(1);
    expect(elements[0].name).toBe('formaggio');
    const week = await getWeek('2026-W19');
    expect(week).toBeDefined();
    expect(week?.slots[0].dishes[0].name).toBe('pasta');
  });

  it('aggiunge elementi nuovi e mantiene quelli esistenti nel DB', async () => {
    await createElement({ name: 'vecchio', maxFrequencyPerWeek: 1 });
    const backup = makeValidBackup({
      elements: [
        { id: 'el-new', name: 'nuovo', maxFrequencyPerWeek: 3, createdAt: 1000, updatedAt: 1000 },
      ],
    });
    await importAll(makeFile(JSON.stringify(backup)));
    const elements = await getAllElements();
    // Il backup aggiunge "nuovo" ma mantiene "vecchio" (merge, non overwrite)
    expect(elements).toHaveLength(2);
    const names = elements.map((e) => e.name).sort();
    expect(names).toEqual(['nuovo', 'vecchio']);
  });

  it('elementi locali rimangono dopo import di backup senza elementi', async () => {
    await createElement({ name: 'formaggio', maxFrequencyPerWeek: 1 });
    const backup = makeValidBackup({ elements: [], weeks: [] });
    await importAll(makeFile(JSON.stringify(backup)));
    const elements = await getAllElements();
    // Gli elementi locali vengono mantenuti (backup vuoto non li cancella)
    expect(elements).toHaveLength(1);
    expect(elements[0].name).toBe('formaggio');
  });

  it('lancia BackupImportError per JSON malformato', async () => {
    await expect(importAll(makeFile('{ non è json }'))).rejects.toThrow(BackupImportError);
    await expect(importAll(makeFile('{ non è json }'))).rejects.toThrow(/JSON valido/);
  });

  it('lancia BackupImportError per formato sconosciuto', async () => {
    const bad = makeValidBackup({ format: 'altro-app' as typeof BACKUP_FORMAT });
    await expect(importAll(makeFile(JSON.stringify(bad)))).rejects.toThrow(BackupImportError);
    await expect(importAll(makeFile(JSON.stringify(bad)))).rejects.toThrow(/Formato/i);
  });

  it('lancia BackupImportError per versione non supportata', async () => {
    const bad = { ...makeValidBackup(), version: 99 };
    await expect(importAll(makeFile(JSON.stringify(bad)))).rejects.toThrow(BackupImportError);
    await expect(importAll(makeFile(JSON.stringify(bad)))).rejects.toThrow(/versione/i);
  });

  it('lancia BackupImportError per schema non valido (elemento senza nome)', async () => {
    const bad = makeValidBackup({
      elements: [{ id: 'x', name: '', maxFrequencyPerWeek: 1, createdAt: 0, updatedAt: 0 }],
    });
    await expect(importAll(makeFile(JSON.stringify(bad)))).rejects.toThrow(BackupImportError);
    await expect(importAll(makeFile(JSON.stringify(bad)))).rejects.toThrow(/Schema/i);
  });

  it('lancia BackupImportError per schema non valido (campo mancante)', async () => {
    // settimana senza isoWeekStart
    const bad = makeValidBackup({
      weeks: [{ id: '2026-W19', slots: [], updatedAt: 0 } as unknown as BackupData['weeks'][0]],
    });
    await expect(importAll(makeFile(JSON.stringify(bad)))).rejects.toThrow(BackupImportError);
  });

  it('non modifica il DB in caso di errore di validazione', async () => {
    await createElement({ name: 'formaggio', maxFrequencyPerWeek: 1 });
    const bad = makeValidBackup({
      elements: [{ id: 'x', name: '', maxFrequencyPerWeek: 1, createdAt: 0, updatedAt: 0 }],
    });
    await expect(importAll(makeFile(JSON.stringify(bad)))).rejects.toThrow(BackupImportError);
    // Il record originale deve ancora esserci (errore prima della transazione)
    const elements = await getAllElements();
    expect(elements).toHaveLength(1);
    expect(elements[0].name).toBe('formaggio');
  });

  it('round-trip: export poi import ripristina i dati', async () => {
    const el = await createElement({ name: 'pesce', maxFrequencyPerWeek: 3 });
    const dish = { id: uuidv4(), name: 'salmone', elementIds: [el.id] };
    await addDishToSlot('2026-W20', 3, 'cena', dish);

    const blob = await exportAll();
    const text = await blob.text();
    const file = makeFile(text, 'backup.json');

    // Svuota e reimporta
    await appDb.elements.clear();
    await appDb.weeks.clear();
    await importAll(file);

    const elements = await getAllElements();
    expect(elements).toHaveLength(1);
    expect(elements[0].name).toBe('pesce');
    const week = await getWeek('2026-W20');
    expect(week?.slots[0].dishes[0].name).toBe('salmone');
  });
});

// ---- Test exportWeeks / exportWeek ----

describe('exportWeeks', () => {
  it('esporta solo le settimane richieste', async () => {
    const dish1 = { id: uuidv4(), name: 'pasta', elementIds: [] };
    const dish2 = { id: uuidv4(), name: 'riso', elementIds: [] };
    await addDishToSlot('2026-W01', 1, 'pranzo', dish1);
    await addDishToSlot('2026-W02', 2, 'cena', dish2);

    const blob = await exportWeeks(['2026-W01']);
    const data = await parseBlob(blob);
    expect(data.weeks).toHaveLength(1);
    expect(data.weeks[0].id).toBe('2026-W01');
  });

  it('include solo gli Elementi referenziati dalle settimane esportate', async () => {
    const el1 = await createElement({ name: 'formaggio', maxFrequencyPerWeek: 1 });
    const el2 = await createElement({ name: 'verdura', maxFrequencyPerWeek: 'unlimited' });
    const dish1 = { id: uuidv4(), name: 'caprese', elementIds: [el1.id] };
    const dish2 = { id: uuidv4(), name: 'insalata', elementIds: [el2.id] };
    await addDishToSlot('2026-W10', 1, 'pranzo', dish1);
    await addDishToSlot('2026-W11', 2, 'cena', dish2);

    // Esporta solo W10: deve contenere solo el1
    const blob = await exportWeeks(['2026-W10']);
    const data = await parseBlob(blob);
    expect(data.weeks).toHaveLength(1);
    expect(data.elements).toHaveLength(1);
    expect(data.elements[0].id).toBe(el1.id);
  });

  it('settimana con piatti senza elementi → elements vuoto', async () => {
    const dish = { id: uuidv4(), name: 'acqua', elementIds: [] };
    await addDishToSlot('2026-W12', 3, 'pranzo', dish);

    const blob = await exportWeeks(['2026-W12']);
    const data = await parseBlob(blob);
    expect(data.weeks).toHaveLength(1);
    expect(data.elements).toHaveLength(0);
  });

  it('weekId non presente nel DB → viene ignorato silenziosamente', async () => {
    const blob = await exportWeeks(['2026-W99']);
    const data = await parseBlob(blob);
    expect(data.weeks).toHaveLength(0);
    expect(data.elements).toHaveLength(0);
  });

  it('esporta più settimane con elementi referenziati deduplificati', async () => {
    const el = await createElement({ name: 'carne bianca', maxFrequencyPerWeek: 3 });
    const dish1 = { id: uuidv4(), name: 'pollo', elementIds: [el.id] };
    const dish2 = { id: uuidv4(), name: 'tacchino', elementIds: [el.id] };
    await addDishToSlot('2026-W20', 1, 'pranzo', dish1);
    await addDishToSlot('2026-W21', 2, 'cena', dish2);

    const blob = await exportWeeks(['2026-W20', '2026-W21']);
    const data = await parseBlob(blob);
    expect(data.weeks).toHaveLength(2);
    // Elemento referenziato in entrambe le settimane → compare una sola volta
    expect(data.elements).toHaveLength(1);
    expect(data.elements[0].id).toBe(el.id);
  });

  it('elemento eliminato dal DB non viene incluso nell\'export', async () => {
    const el = await createElement({ name: 'pesce', maxFrequencyPerWeek: 2 });
    const dish = { id: uuidv4(), name: 'trota', elementIds: [el.id] };
    await addDishToSlot('2026-W30', 1, 'pranzo', dish);
    // Simula eliminazione dell'elemento dal DB
    await appDb.elements.delete(el.id);

    const blob = await exportWeeks(['2026-W30']);
    const data = await parseBlob(blob);
    expect(data.weeks).toHaveLength(1);
    expect(data.elements).toHaveLength(0);
  });

  it('il Blob ha il formato e la versione corretti', async () => {
    const blob = await exportWeeks([]);
    const data = await parseBlob(blob);
    expect(data.format).toBe(BACKUP_FORMAT);
    expect(data.version).toBe(BACKUP_VERSION);
    expect(blob.type).toBe('application/json');
  });
});

describe('exportWeek', () => {
  it('è un alias di exportWeeks con un singolo weekId', async () => {
    const el = await createElement({ name: 'riso', maxFrequencyPerWeek: 2 });
    const dish = { id: uuidv4(), name: 'risotto', elementIds: [el.id] };
    await addDishToSlot('2026-W40', 4, 'pranzo', dish);

    const blobSingle = await exportWeek('2026-W40');
    const blobMulti = await exportWeeks(['2026-W40']);

    const dataSingle = await parseBlob(blobSingle);
    const dataMulti = await parseBlob(blobMulti);

    // Il contenuto deve essere equivalente (stessi elements e weeks)
    expect(dataSingle.weeks).toHaveLength(dataMulti.weeks.length);
    expect(dataSingle.elements).toHaveLength(dataMulti.elements.length);
    expect(dataSingle.weeks[0].id).toBe(dataMulti.weeks[0].id);
  });
});

// ---- Test importWeeks ----

describe('importWeeks — overwrite', () => {
  const makeWeek = (id: string, dishName: string): BackupData['weeks'][0] => ({
    id,
    isoWeekStart: '2026-01-05',
    slots: [{ day: 1, meal: 'pranzo', dishes: [{ id: uuidv4(), name: dishName, elementIds: [] }] }],
    updatedAt: Date.now(),
  });

  it('sostituisce una settimana esistente con quella del file', async () => {
    const dish1 = { id: uuidv4(), name: 'vecchio', elementIds: [] };
    await addDishToSlot('2026-W50', 1, 'pranzo', dish1);

    const fileData: BackupData = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      elements: [],
      weeks: [makeWeek('2026-W50', 'nuovo')],
    };

    await importWeeks(fileData, 'overwrite');
    const week = await getWeek('2026-W50');
    expect(week?.slots[0].dishes[0].name).toBe('nuovo');
  });

  it('crea la settimana locale se non esiste', async () => {
    const fileData: BackupData = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      elements: [],
      weeks: [makeWeek('2026-W51', 'nuovo')],
    };

    await importWeeks(fileData, 'overwrite');
    const week = await getWeek('2026-W51');
    expect(week).toBeDefined();
    expect(week?.slots[0].dishes[0].name).toBe('nuovo');
  });

  it('non tocca le settimane non presenti nel file', async () => {
    const dish = { id: uuidv4(), name: 'intatta', elementIds: [] };
    await addDishToSlot('2026-W52', 2, 'cena', dish);

    const fileData: BackupData = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      elements: [],
      weeks: [makeWeek('2026-W50', 'altra')],
    };

    await importWeeks(fileData, 'overwrite');
    const week = await getWeek('2026-W52');
    expect(week?.slots[0].dishes[0].name).toBe('intatta');
  });

  it('weeks vuoto → nessuna scrittura', async () => {
    const dish = { id: uuidv4(), name: 'preesistente', elementIds: [] };
    await addDishToSlot('2026-W53', 3, 'pranzo', dish);

    const fileData: BackupData = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      elements: [],
      weeks: [],
    };

    await importWeeks(fileData, 'overwrite');
    const week = await getWeek('2026-W53');
    expect(week?.slots[0].dishes[0].name).toBe('preesistente');
  });
});

describe('importWeeks — granular', () => {
  it('importa solo gli slot selezionati', async () => {
    const dish = { id: uuidv4(), name: 'file-pranzo', elementIds: [] };
    const fileWeek: BackupData['weeks'][0] = {
      id: '2027-W01',
      isoWeekStart: '2027-01-04',
      slots: [
        { day: 1, meal: 'pranzo', dishes: [dish] },
        { day: 1, meal: 'cena', dishes: [{ id: uuidv4(), name: 'file-cena', elementIds: [] }] },
      ],
      updatedAt: Date.now(),
    };
    const fileData: BackupData = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      elements: [],
      weeks: [fileWeek],
    };

    const selected: SlotKey[] = [{ weekId: '2027-W01', day: 1, meal: 'pranzo' }];
    await importWeeks(fileData, 'granular', selected);

    const week = await getWeek('2027-W01');
    const pranzo = week?.slots.find((s) => s.day === 1 && s.meal === 'pranzo');
    const cena = week?.slots.find((s) => s.day === 1 && s.meal === 'cena');
    expect(pranzo?.dishes[0].name).toBe('file-pranzo');
    // La cena non era selezionata → non deve essere importata
    expect(cena).toBeUndefined();
  });

  it('non modifica gli slot non selezionati della settimana locale', async () => {
    const localDish = { id: uuidv4(), name: 'locale-cena', elementIds: [] };
    await addDishToSlot('2027-W02', 1, 'cena', localDish);

    const fileData: BackupData = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      elements: [],
      weeks: [
        {
          id: '2027-W02',
          isoWeekStart: '2027-01-11',
          slots: [
            { day: 1, meal: 'pranzo', dishes: [{ id: uuidv4(), name: 'file-pranzo', elementIds: [] }] },
            { day: 1, meal: 'cena', dishes: [{ id: uuidv4(), name: 'file-cena', elementIds: [] }] },
          ],
          updatedAt: Date.now(),
        },
      ],
    };

    // Seleziono solo pranzo
    const selected: SlotKey[] = [{ weekId: '2027-W02', day: 1, meal: 'pranzo' }];
    await importWeeks(fileData, 'granular', selected);

    const week = await getWeek('2027-W02');
    const cena = week?.slots.find((s) => s.day === 1 && s.meal === 'cena');
    expect(cena?.dishes[0].name).toBe('locale-cena');
  });

  it('crea la settimana locale se non esiste', async () => {
    const fileData: BackupData = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      elements: [],
      weeks: [
        {
          id: '2027-W03',
          isoWeekStart: '2027-01-18',
          slots: [{ day: 2, meal: 'cena', dishes: [{ id: uuidv4(), name: 'nuova', elementIds: [] }] }],
          updatedAt: Date.now(),
        },
      ],
    };

    const selected: SlotKey[] = [{ weekId: '2027-W03', day: 2, meal: 'cena' }];
    await importWeeks(fileData, 'granular', selected);

    const week = await getWeek('2027-W03');
    expect(week).toBeDefined();
    expect(week?.slots[0].dishes[0].name).toBe('nuova');
  });

  it('selectedSlots vuoto → nessuna modifica', async () => {
    const local = { id: uuidv4(), name: 'locale', elementIds: [] };
    await addDishToSlot('2027-W04', 1, 'pranzo', local);

    const fileData: BackupData = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      elements: [],
      weeks: [
        {
          id: '2027-W04',
          isoWeekStart: '2027-01-25',
          slots: [{ day: 1, meal: 'pranzo', dishes: [{ id: uuidv4(), name: 'dal-file', elementIds: [] }] }],
          updatedAt: Date.now(),
        },
      ],
    };

    await importWeeks(fileData, 'granular', []);
    const week = await getWeek('2027-W04');
    expect(week?.slots[0].dishes[0].name).toBe('locale');
  });

  it('sovrascrive piatti locali dello stesso slot con quelli del file', async () => {
    const localDish = { id: uuidv4(), name: 'locale-pranzo', elementIds: [] };
    await addDishToSlot('2027-W05', 3, 'pranzo', localDish);

    const fileData: BackupData = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      elements: [],
      weeks: [
        {
          id: '2027-W05',
          isoWeekStart: '2027-02-01',
          slots: [{ day: 3, meal: 'pranzo', dishes: [{ id: uuidv4(), name: 'file-pranzo', elementIds: [] }] }],
          updatedAt: Date.now(),
        },
      ],
    };

    const selected: SlotKey[] = [{ weekId: '2027-W05', day: 3, meal: 'pranzo' }];
    await importWeeks(fileData, 'granular', selected);

    const week = await getWeek('2027-W05');
    const slot = week?.slots.find((s) => s.day === 3 && s.meal === 'pranzo');
    // Deve esserci solo il piatto dal file (quello locale è stato sostituito)
    expect(slot?.dishes).toHaveLength(1);
    expect(slot?.dishes[0].name).toBe('file-pranzo');
  });
});

// ---- Helper per T6.6 / T6.7 ----

function makeFileData(overrides: Partial<BackupData> = {}): BackupData {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    elements: [],
    weeks: [],
    ...overrides,
  };
}

const EMPTY_DECISIONS: ElementImportDecisions = { addMissingIds: [], conflicts: [] };

// ---- Test analyzeElementImport ----

describe('analyzeElementImport', () => {
  it('nessun elemento nel file → analysis vuota', async () => {
    const data = makeFileData();
    const analysis = await analyzeElementImport(data);
    expect(analysis.missing).toHaveLength(0);
    expect(analysis.conflicts).toHaveLength(0);
    expect(analysis.autoRemap.size).toBe(0);
  });

  it('elemento nel file già presente per ID → ignorato', async () => {
    const el = await createElement({ name: 'formaggio', maxFrequencyPerWeek: 1 });
    const data = makeFileData({ elements: [el] });
    const analysis = await analyzeElementImport(data);
    expect(analysis.missing).toHaveLength(0);
    expect(analysis.conflicts).toHaveLength(0);
    expect(analysis.autoRemap.size).toBe(0);
  });

  it('elemento nel file non presente nel DB → missing', async () => {
    const fileEl = { id: uuidv4(), name: 'verdura', maxFrequencyPerWeek: 'unlimited' as const, createdAt: 0, updatedAt: 0 };
    const data = makeFileData({ elements: [fileEl] });
    const analysis = await analyzeElementImport(data);
    expect(analysis.missing).toHaveLength(1);
    expect(analysis.missing[0].id).toBe(fileEl.id);
  });

  it('stesso nome, frequenza diversa → conflict', async () => {
    const local = await createElement({ name: 'carne rossa', maxFrequencyPerWeek: 2 });
    const fileEl = { id: uuidv4(), name: 'carne rossa', maxFrequencyPerWeek: 3 as const, createdAt: 0, updatedAt: 0 };
    const data = makeFileData({ elements: [fileEl] });
    const analysis = await analyzeElementImport(data);
    expect(analysis.conflicts).toHaveLength(1);
    expect(analysis.conflicts[0].fileElement.id).toBe(fileEl.id);
    expect(analysis.conflicts[0].localElement.id).toBe(local.id);
  });

  it('stesso nome (case-insensitive), frequenza diversa → conflict', async () => {
    await createElement({ name: 'Pesce', maxFrequencyPerWeek: 3 });
    const fileEl = { id: uuidv4(), name: 'pesce', maxFrequencyPerWeek: 2 as const, createdAt: 0, updatedAt: 0 };
    const data = makeFileData({ elements: [fileEl] });
    const analysis = await analyzeElementImport(data);
    expect(analysis.conflicts).toHaveLength(1);
  });

  it('stesso nome, stessa frequenza, ID diverso → autoRemap', async () => {
    const local = await createElement({ name: 'verdura', maxFrequencyPerWeek: 'unlimited' });
    const fileEl = { id: uuidv4(), name: 'verdura', maxFrequencyPerWeek: 'unlimited' as const, createdAt: 0, updatedAt: 0 };
    const data = makeFileData({ elements: [fileEl] });
    const analysis = await analyzeElementImport(data);
    expect(analysis.autoRemap.size).toBe(1);
    expect(analysis.autoRemap.get(fileEl.id)).toBe(local.id);
    expect(analysis.missing).toHaveLength(0);
    expect(analysis.conflicts).toHaveLength(0);
  });

  it('classifica correttamente più elementi in categorie diverse', async () => {
    const localEl = await createElement({ name: 'formaggio', maxFrequencyPerWeek: 1 });
    const presentEl = { ...localEl }; // stesso ID → ignorato
    const missingEl = { id: uuidv4(), name: 'carne bianca', maxFrequencyPerWeek: 3 as const, createdAt: 0, updatedAt: 0 };
    const localVerdura = await createElement({ name: 'verdura', maxFrequencyPerWeek: 'unlimited' });
    const sameVerdura = { id: uuidv4(), name: 'verdura', maxFrequencyPerWeek: 'unlimited' as const, createdAt: 0, updatedAt: 0 };
    const data = makeFileData({ elements: [presentEl, missingEl, sameVerdura] });
    const analysis = await analyzeElementImport(data);
    expect(analysis.missing).toHaveLength(1);
    expect(analysis.missing[0].id).toBe(missingEl.id);
    expect(analysis.autoRemap.get(sameVerdura.id)).toBe(localVerdura.id);
    expect(analysis.conflicts).toHaveLength(0);
  });
});

// ---- Test applyElementDecisions ----

describe('applyElementDecisions — add missing', () => {
  it('aggiunge un elemento mancante con ID del file', async () => {
    const fileEl = { id: uuidv4(), name: 'pesce', maxFrequencyPerWeek: 2 as const, createdAt: 1000, updatedAt: 1000 };
    const data = makeFileData({ elements: [fileEl] });
    const analysis = await analyzeElementImport(data);
    const decisions: ElementImportDecisions = { addMissingIds: [fileEl.id], conflicts: [] };
    await applyElementDecisions(data, analysis, decisions);
    const saved = await getElementById(fileEl.id);
    expect(saved).toBeDefined();
    expect(saved?.name).toBe('pesce');
    expect(saved?.maxFrequencyPerWeek).toBe(2);
  });

  it('non aggiunge un elemento mancante se non scelto', async () => {
    const fileEl = { id: uuidv4(), name: 'pesce', maxFrequencyPerWeek: 2 as const, createdAt: 1000, updatedAt: 1000 };
    const data = makeFileData({ elements: [fileEl] });
    const analysis = await analyzeElementImport(data);
    await applyElementDecisions(data, analysis, EMPTY_DECISIONS);
    const saved = await getElementById(fileEl.id);
    expect(saved).toBeUndefined();
  });
});

describe('applyElementDecisions — conflict keep-local', () => {
  it('tieni-il-tuo: rimappa le dish al localElement.id', async () => {
    const local = await createElement({ name: 'carne rossa', maxFrequencyPerWeek: 2 });
    const fileEl = { id: uuidv4(), name: 'carne rossa', maxFrequencyPerWeek: 3 as const, createdAt: 0, updatedAt: 0 };
    const dishId = uuidv4();
    const data = makeFileData({
      elements: [fileEl],
      weeks: [{
        id: '2028-W01', isoWeekStart: '2028-01-03', updatedAt: 0,
        slots: [{ day: 1, meal: 'pranzo', dishes: [{ id: dishId, name: 'bistecca', elementIds: [fileEl.id] }] }],
      }],
    });
    const analysis = await analyzeElementImport(data);
    const decisions: ElementImportDecisions = {
      addMissingIds: [],
      conflicts: [{ fileElementId: fileEl.id, resolution: 'keep-local' }],
    };
    const processed = await applyElementDecisions(data, analysis, decisions);
    // La dish nel processedData deve avere il localElement.id
    expect(processed.weeks[0].slots[0].dishes[0].elementIds[0]).toBe(local.id);
    // L'elemento locale non deve essere stato modificato
    const localAfter = await getElementById(local.id);
    expect(localAfter?.maxFrequencyPerWeek).toBe(2);
  });
});

describe('applyElementDecisions — conflict overwrite', () => {
  it('sovrascrivi: aggiorna la frequenza locale e rimappa', async () => {
    const local = await createElement({ name: 'carne rossa', maxFrequencyPerWeek: 2 });
    const fileEl = { id: uuidv4(), name: 'carne rossa', maxFrequencyPerWeek: 3 as const, createdAt: 0, updatedAt: 0 };
    const data = makeFileData({ elements: [fileEl] });
    const analysis = await analyzeElementImport(data);
    const decisions: ElementImportDecisions = {
      addMissingIds: [],
      conflicts: [{ fileElementId: fileEl.id, resolution: 'overwrite' }],
    };
    await applyElementDecisions(data, analysis, decisions);
    const localAfter = await getElementById(local.id);
    expect(localAfter?.maxFrequencyPerWeek).toBe(3);
  });
});

describe('applyElementDecisions — conflict rename', () => {
  it('rinomina: aggiunge il file element con il nuovo nome', async () => {
    await createElement({ name: 'carne rossa', maxFrequencyPerWeek: 2 });
    const fileEl = { id: uuidv4(), name: 'carne rossa', maxFrequencyPerWeek: 3 as const, createdAt: 0, updatedAt: 0 };
    const data = makeFileData({ elements: [fileEl] });
    const analysis = await analyzeElementImport(data);
    const decisions: ElementImportDecisions = {
      addMissingIds: [],
      conflicts: [{ fileElementId: fileEl.id, resolution: 'rename', newName: 'carne rossa (ospite)' }],
    };
    await applyElementDecisions(data, analysis, decisions);
    const added = await getElementById(fileEl.id);
    expect(added).toBeDefined();
    expect(added?.name).toBe('carne rossa (ospite)');
    expect(added?.maxFrequencyPerWeek).toBe(3);
  });
});

describe('applyElementDecisions — autoRemap', () => {
  it('autoRemap: rimappa ID nelle dishes senza toccare il DB', async () => {
    const local = await createElement({ name: 'verdura', maxFrequencyPerWeek: 'unlimited' });
    const fileEl = { id: uuidv4(), name: 'verdura', maxFrequencyPerWeek: 'unlimited' as const, createdAt: 0, updatedAt: 0 };
    const dishId = uuidv4();
    const data = makeFileData({
      elements: [fileEl],
      weeks: [{
        id: '2028-W02', isoWeekStart: '2028-01-10', updatedAt: 0,
        slots: [{ day: 2, meal: 'cena', dishes: [{ id: dishId, name: 'insalata', elementIds: [fileEl.id] }] }],
      }],
    });
    const analysis = await analyzeElementImport(data);
    const processed = await applyElementDecisions(data, analysis, EMPTY_DECISIONS);
    // La dish deve avere il localElement.id (rimappatura automatica)
    expect(processed.weeks[0].slots[0].dishes[0].elementIds[0]).toBe(local.id);
  });

  it('data senza rimappature necessarie → ritorna data invariato', async () => {
    const el = await createElement({ name: 'formaggio', maxFrequencyPerWeek: 1 });
    const data = makeFileData({ elements: [el] }); // stesso ID → già presente
    const analysis = await analyzeElementImport(data);
    const processed = await applyElementDecisions(data, analysis, EMPTY_DECISIONS);
    expect(processed).toBe(data); // stessa referenza (nessuna copia)
  });
});

// ---- T6.7 — Test integrazione completo ----

describe('T6.7 — integrazione: export → import → verifica integrità', () => {
  it('round-trip completo: dati invariati dopo export + importAll', async () => {
    // ── Stato A ──
    const el1 = await createElement({ name: 'carne rossa', maxFrequencyPerWeek: 2 });
    const el2 = await createElement({ name: 'verdura', maxFrequencyPerWeek: 'unlimited' });
    const dish1 = { id: uuidv4(), name: 'bistecca', elementIds: [el1.id] };
    const dish2 = { id: uuidv4(), name: 'insalata', elementIds: [el2.id] };
    const dish3 = { id: uuidv4(), name: 'pasta', elementIds: [] };
    await addDishToSlot('2028-W10', 1, 'pranzo', dish1);
    await addDishToSlot('2028-W10', 2, 'cena', dish2);
    await addDishToSlot('2028-W11', 3, 'pranzo', dish3);

    // Esporta tutto
    const blob = await exportAll();
    const text = await blob.text();

    // ── Svuota DB ──
    await appDb.elements.clear();
    await appDb.weeks.clear();

    // Importa
    await importAll(new File([text], 'backup.json'));

    // ── Verifica integrità ──
    const elements = await getAllElements();
    expect(elements).toHaveLength(2);

    const week10 = await getWeek('2028-W10');
    expect(week10).toBeDefined();
    expect(week10?.slots).toHaveLength(2);

    const pranzo = week10?.slots.find((s) => s.day === 1 && s.meal === 'pranzo');
    expect(pranzo?.dishes[0].name).toBe('bistecca');
    expect(pranzo?.dishes[0].elementIds).toContain(el1.id);

    const cena = week10?.slots.find((s) => s.day === 2 && s.meal === 'cena');
    expect(cena?.dishes[0].elementIds).toContain(el2.id);

    const week11 = await getWeek('2028-W11');
    expect(week11?.slots[0].dishes[0].name).toBe('pasta');
  });

  it('export settimana + import in DB diverso con autoRemap degli elementi', async () => {
    // ── DB "mittente" ──
    const senderEl = await createElement({ name: 'pesce', maxFrequencyPerWeek: 3 });
    const dish = { id: uuidv4(), name: 'salmone', elementIds: [senderEl.id] };
    await addDishToSlot('2028-W20', 4, 'cena', dish);
    const blob = await exportWeek('2028-W20');

    // ── DB "destinatario": ha già 'pesce' con stessa freq ma ID diverso ──
    await appDb.elements.clear();
    await appDb.weeks.clear();
    const recipientEl = await createElement({ name: 'pesce', maxFrequencyPerWeek: 3 });
    expect(recipientEl.id).not.toBe(senderEl.id); // ID diverso

    // Analisi del file nel contesto del destinatario
    const file = new File([await blob.text()], 'shared.json');
    const { parseSharedFile } = await import('../backup');
    const fileData = await parseSharedFile(file);

    const analysis = await analyzeElementImport(fileData);
    // autoRemap: senderEl.id → recipientEl.id (stessa nome + stessa freq)
    expect(analysis.autoRemap.get(senderEl.id)).toBe(recipientEl.id);
    expect(analysis.missing).toHaveLength(0);
    expect(analysis.conflicts).toHaveLength(0);

    // Applica decisioni vuote (solo autoRemap viene applicato)
    const processed = await applyElementDecisions(fileData, analysis, EMPTY_DECISIONS);
    // La dish deve avere l'ID del destinatario
    expect(processed.weeks[0].slots[0].dishes[0].elementIds[0]).toBe(recipientEl.id);

    // Importa le settimane con i dati processati
    await importWeeks(processed, 'overwrite');
    const week = await getWeek('2028-W20');
    const slot = week?.slots.find((s) => s.day === 4 && s.meal === 'cena');
    expect(slot?.dishes[0].name).toBe('salmone');
    // Verifica che il piatto referenzi l'elemento locale del destinatario
    expect(slot?.dishes[0].elementIds[0]).toBe(recipientEl.id);
  });

  it('import con elemento mancante scelto: elemento viene aggiunto e referenza funziona', async () => {
    // ── File ──
    const fileEl = { id: uuidv4(), name: 'legumi', maxFrequencyPerWeek: 2 as const, createdAt: 1000, updatedAt: 1000 };
    const dish = { id: uuidv4(), name: 'lenticchie', elementIds: [fileEl.id] };
    const fileData = makeFileData({
      elements: [fileEl],
      weeks: [{
        id: '2028-W30', isoWeekStart: '2028-07-23', updatedAt: 0,
        slots: [{ day: 1, meal: 'pranzo', dishes: [dish] }],
      }],
    });

    // ── DB destinatario: vuoto ──
    const analysis = await analyzeElementImport(fileData);
    expect(analysis.missing).toHaveLength(1);

    const decisions: ElementImportDecisions = {
      addMissingIds: [fileEl.id],
      conflicts: [],
    };
    const processed = await applyElementDecisions(fileData, analysis, decisions);
    await importWeeks(processed, 'overwrite');

    const saved = await getElementById(fileEl.id);
    expect(saved?.name).toBe('legumi');
    const week = await getWeek('2028-W30');
    expect(week?.slots[0].dishes[0].elementIds[0]).toBe(fileEl.id);
  });

  it('import con conflitto keep-local: frequenza locale invariata, dish rimappata', async () => {
    // ── DB destinatario ──
    const localEl = await createElement({ name: 'carne rossa', maxFrequencyPerWeek: 2 });
    const fileEl = { id: uuidv4(), name: 'carne rossa', maxFrequencyPerWeek: 4 as const, createdAt: 0, updatedAt: 0 };
    const dish = { id: uuidv4(), name: 'filetto', elementIds: [fileEl.id] };
    const fileData = makeFileData({
      elements: [fileEl],
      weeks: [{
        id: '2028-W40', isoWeekStart: '2028-10-01', updatedAt: 0,
        slots: [{ day: 1, meal: 'cena', dishes: [dish] }],
      }],
    });

    const analysis = await analyzeElementImport(fileData);
    const decisions: ElementImportDecisions = {
      addMissingIds: [],
      conflicts: [{ fileElementId: fileEl.id, resolution: 'keep-local' }],
    };
    const processed = await applyElementDecisions(fileData, analysis, decisions);
    await importWeeks(processed, 'overwrite');

    // Frequenza locale non cambiata
    const localAfter = await getElementById(localEl.id);
    expect(localAfter?.maxFrequencyPerWeek).toBe(2);

    // Dish punta al localEl.id
    const week = await getWeek('2028-W40');
    expect(week?.slots[0].dishes[0].elementIds[0]).toBe(localEl.id);

    // Il fileEl.id non deve essere nel DB
    expect(await getElementById(fileEl.id)).toBeUndefined();
  });

  it('export parziale (exportWeeks) + import granulare mantiene i dati dell\'altra settimana', async () => {
    // ── Setup ──
    const el = await createElement({ name: 'verdura', maxFrequencyPerWeek: 'unlimited' });
    const d1 = { id: uuidv4(), name: 'risotto', elementIds: [] };
    const d2 = { id: uuidv4(), name: 'minestra', elementIds: [el.id] };
    await addDishToSlot('2028-W50', 1, 'pranzo', d1); // settimana che verrà importata
    await addDishToSlot('2028-W51', 2, 'cena', d2);   // settimana locale da preservare

    // Esporta solo W50
    const blob = await exportWeeks(['2028-W50']);
    const file = new File([await blob.text()], 'shared.json');
    const { parseSharedFile } = await import('../backup');
    const fileData = await parseSharedFile(file);

    // Seleziona solo lo slot lunedì-pranzo di W50
    const selected: SlotKey[] = [{ weekId: '2028-W50', day: 1, meal: 'pranzo' }];
    const analysis = await analyzeElementImport(fileData);
    const processed = await applyElementDecisions(fileData, analysis, EMPTY_DECISIONS);
    await importWeeks(processed, 'granular', selected);

    // W50 importata correttamente
    const w50 = await getWeek('2028-W50');
    expect(w50?.slots[0].dishes[0].name).toBe('risotto');

    // W51 (non toccata) è intatta
    const w51 = await getWeek('2028-W51');
    expect(w51?.slots[0].dishes[0].name).toBe('minestra');
    expect(w51?.slots[0].dishes[0].elementIds[0]).toBe(el.id);
  });
});
