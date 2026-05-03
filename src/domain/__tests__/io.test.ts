import { describe, it, expect } from 'vitest';
import { parseExport, SUPPORTED_SCHEMA_VERSION, type ExportData } from '../../io/schemas';

const validExport: ExportData = {
  schemaVersion: SUPPORTED_SCHEMA_VERSION,
  exportedAt: new Date().toISOString(),
  dishes: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Pasta al pomodoro',
      proteinCategories: ['CEREALI'],
      tags: ['primo'],
      createdAt: new Date().toISOString(),
    },
  ],
  menus: [
    {
      isoWeek: '2026-W18',
      meals: [
        {
          id: '00000000-0000-4000-8000-000000000002',
          dishId: '00000000-0000-4000-8000-000000000001',
          date: '2026-04-27',
          slot: 'PRANZO',
        },
      ],
    },
  ],
  settings: {
    constraints: [],
    recencyWindowWeeks: 4,
  },
};

describe('io', () => {
  it('import con schemaVersion sconosciuta → throw con messaggio', () => {
    expect(() => parseExport({ ...validExport, schemaVersion: 99 })).toThrow(/versione/i);
  });

  it('round-trip export → import preserva i dati', () => {
    const serialized = JSON.stringify(validExport);
    const parsed = parseExport(JSON.parse(serialized));
    expect(parsed.dishes).toHaveLength(1);
    expect(parsed.dishes[0].name).toBe('Pasta al pomodoro');
    expect(parsed.menus).toHaveLength(1);
    expect(parsed.menus[0].meals).toHaveLength(1);
    expect(parsed.settings.recencyWindowWeeks).toBe(4);
  });
});
