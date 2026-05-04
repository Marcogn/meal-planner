import { describe, it, expect } from 'vitest';
import { computeWeeklyFrequencies } from '../frequency';
import type { Element, Week } from '../types';

// ---- helpers ----

function makeElement(id: string, max: Element['maxFrequencyPerWeek']): Element {
  return { id, name: id, maxFrequencyPerWeek: max, createdAt: 0, updatedAt: 0 };
}

const EMPTY_WEEK: Week = {
  id: '2026-W19',
  isoWeekStart: '2026-05-04',
  slots: [],
  updatedAt: 0,
};

function makeWeekWithDishes(
  dishes: Array<{ elementIds: string[] }>,
): Week {
  return {
    id: '2026-W19',
    isoWeekStart: '2026-05-04',
    slots: [
      {
        day: 1,
        meal: 'pranzo',
        dishes: dishes.map((d, i) => ({ id: `dish${i}`, name: `piatto${i}`, elementIds: d.elementIds })),
      },
    ],
    updatedAt: 0,
  };
}

// ---- tests ----

describe('computeWeeklyFrequencies', () => {
  describe('caso vuoto', () => {
    it('week senza slot → tutti gli Elementi a used:0, exceeded:false', () => {
      const elements = [
        makeElement('carne_rossa', 2),
        makeElement('verdura', 'unlimited'),
      ];
      const result = computeWeeklyFrequencies(EMPTY_WEEK, elements);

      expect(result.size).toBe(2);
      expect(result.get('carne_rossa')).toEqual({ used: 0, max: 2, exceeded: false });
      expect(result.get('verdura')).toEqual({ used: 0, max: 'unlimited', exceeded: false });
    });

    it('nessun Elemento → mappa vuota', () => {
      const result = computeWeeklyFrequencies(EMPTY_WEEK, []);
      expect(result.size).toBe(0);
    });
  });

  describe('stesso Elemento in più piatti (conta n)', () => {
    it('2 piatti distinti con stesso Elemento → used:2', () => {
      const elements = [makeElement('formaggio', 3)];
      const week = makeWeekWithDishes([
        { elementIds: ['formaggio'] },
        { elementIds: ['formaggio'] },
      ]);
      const result = computeWeeklyFrequencies(week, elements);
      expect(result.get('formaggio')?.used).toBe(2);
    });

    it('3 piatti in slot diversi (giorni/pasti diversi) → used:3', () => {
      const elements = [makeElement('pesce', 3)];
      const week: Week = {
        id: '2026-W19',
        isoWeekStart: '2026-05-04',
        slots: [
          { day: 1, meal: 'pranzo', dishes: [{ id: 'd1', name: 'p1', elementIds: ['pesce'] }] },
          { day: 3, meal: 'pranzo', dishes: [{ id: 'd2', name: 'p2', elementIds: ['pesce'] }] },
          { day: 5, meal: 'cena',   dishes: [{ id: 'd3', name: 'p3', elementIds: ['pesce'] }] },
        ],
        updatedAt: 0,
      };
      const result = computeWeeklyFrequencies(week, elements);
      expect(result.get('pesce')?.used).toBe(3);
      expect(result.get('pesce')?.exceeded).toBe(false);
    });
  });

  describe('stesso Elemento ripetuto nello stesso piatto (conta 1)', () => {
    it('elementIds con duplicati → used:1', () => {
      const elements = [makeElement('pane', 'unlimited')];
      const week = makeWeekWithDishes([
        { elementIds: ['pane', 'pane', 'pane'] },
      ]);
      const result = computeWeeklyFrequencies(week, elements);
      expect(result.get('pane')?.used).toBe(1);
    });
  });

  describe('sforamento', () => {
    it('used > max (finito) → exceeded:true', () => {
      const elements = [makeElement('carne_rossa', 2)];
      const week = makeWeekWithDishes([
        { elementIds: ['carne_rossa'] },
        { elementIds: ['carne_rossa'] },
        { elementIds: ['carne_rossa'] }, // terza volta → sforato
      ]);
      const result = computeWeeklyFrequencies(week, elements);
      expect(result.get('carne_rossa')).toEqual({ used: 3, max: 2, exceeded: true });
    });

    it('used === max → exceeded:false (non sforato)', () => {
      const elements = [makeElement('carne_rossa', 2)];
      const week = makeWeekWithDishes([
        { elementIds: ['carne_rossa'] },
        { elementIds: ['carne_rossa'] }, // esattamente max
      ]);
      const result = computeWeeklyFrequencies(week, elements);
      expect(result.get('carne_rossa')?.exceeded).toBe(false);
    });

    it('sforamento con max:1', () => {
      const elements = [makeElement('formaggio', 1)];
      const week = makeWeekWithDishes([
        { elementIds: ['formaggio'] },
        { elementIds: ['formaggio'] }, // secondo → sforato
      ]);
      const result = computeWeeklyFrequencies(week, elements);
      expect(result.get('formaggio')?.exceeded).toBe(true);
    });
  });

  describe('unlimited', () => {
    it('unlimited → mai exceeded:true anche se usato molte volte', () => {
      const elements = [makeElement('verdura', 'unlimited')];
      const week = makeWeekWithDishes([
        { elementIds: ['verdura'] },
        { elementIds: ['verdura'] },
        { elementIds: ['verdura'] },
        { elementIds: ['verdura'] },
        { elementIds: ['verdura'] },
        { elementIds: ['verdura'] },
        { elementIds: ['verdura'] },
      ]);
      const result = computeWeeklyFrequencies(week, elements);
      expect(result.get('verdura')?.used).toBe(7);
      expect(result.get('verdura')?.exceeded).toBe(false);
    });
  });

  describe('Elemento referenziato ma non più in archivio', () => {
    it('Elemento orfano → voce con max:unlimited, exceeded:false', () => {
      const elements: Element[] = []; // archivio vuoto
      const week = makeWeekWithDishes([
        { elementIds: ['elemento_cancellato'] },
        { elementIds: ['elemento_cancellato'] },
      ]);
      const result = computeWeeklyFrequencies(week, elements);
      expect(result.get('elemento_cancellato')).toEqual({
        used: 2,
        max: 'unlimited',
        exceeded: false,
      });
    });
  });

  describe('più Elementi in un piatto', () => {
    it('piatto con 3 Elementi distinti → ognuno conta 1', () => {
      const elements = [
        makeElement('formaggio', 3),
        makeElement('verdura', 'unlimited'),
        makeElement('pane', 'unlimited'),
      ];
      const week = makeWeekWithDishes([
        { elementIds: ['formaggio', 'verdura', 'pane'] },
      ]);
      const result = computeWeeklyFrequencies(week, elements);
      expect(result.get('formaggio')?.used).toBe(1);
      expect(result.get('verdura')?.used).toBe(1);
      expect(result.get('pane')?.used).toBe(1);
    });
  });
});
