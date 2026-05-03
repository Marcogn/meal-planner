import { describe, it, expect } from 'vitest';
import { rankSuggestions } from '../ranker';
import type { Dish, WeeklyMenu, Settings } from '../types';

function makeDish(id: string, cats: string[]): Dish {
  return {
    id,
    name: `Dish ${id}`,
    proteinCategories: cats as Dish['proteinCategories'],
    tags: [],
    createdAt: new Date().toISOString(),
  };
}

function emptyMenu(isoWeek: string): WeeklyMenu {
  return { isoWeek, meals: [] };
}

const defaultSettings: Settings = {
  constraints: [],
  recencyWindowWeeks: 4,
};

describe('rankSuggestions', () => {
  it('piatto che copre un min mancante ha ranking > piatto generico', () => {
    const dishWithMin = makeDish('d1', ['PESCE']);
    const genericDish = makeDish('d2', ['ALTRO']);
    const settings: Settings = {
      constraints: [{ category: 'PESCE', minPerWeek: 2 }],
      recencyWindowWeeks: 4,
    };
    const ranked = rankSuggestions(
      [dishWithMin, genericDish],
      emptyMenu('2026-W18'),
      [],
      settings
    );
    const scoreD1 = ranked.find((r) => r.dish.id === 'd1')!.score;
    const scoreD2 = ranked.find((r) => r.dish.id === 'd2')!.score;
    expect(scoreD1).toBeGreaterThan(scoreD2);
  });

  it('piatto che violerebbe max non è nei risultati', () => {
    const dish = makeDish('d1', ['CARNE_ROSSA']);
    const menu: WeeklyMenu = {
      isoWeek: '2026-W18',
      meals: [
        { id: 'm1', dishId: 'd1', date: '2026-04-27', slot: 'PRANZO' },
        { id: 'm2', dishId: 'd1', date: '2026-04-28', slot: 'PRANZO' },
      ],
    };
    const settings: Settings = {
      constraints: [{ category: 'CARNE_ROSSA', maxPerWeek: 2 }],
      recencyWindowWeeks: 4,
    };
    const ranked = rankSuggestions([dish], menu, [], settings);
    expect(ranked.find((r) => r.dish.id === 'd1')).toBeUndefined();
  });

  it('piatto usato la settimana scorsa ha ranking < stesso piatto usato 4 settimane fa', () => {
    const dish = makeDish('d1', ['LEGUMI']);
    const recentHistory: WeeklyMenu[] = [
      {
        isoWeek: '2026-W17',
        meals: [{ id: 'm1', dishId: 'd1', date: '2026-04-20', slot: 'PRANZO' }],
      },
    ];
    const oldHistory: WeeklyMenu[] = [
      {
        isoWeek: '2026-W14',
        meals: [{ id: 'm2', dishId: 'd1', date: '2026-03-30', slot: 'PRANZO' }],
      },
    ];
    const currentMenu = emptyMenu('2026-W18');
    const rankedRecent = rankSuggestions([dish], currentMenu, recentHistory, defaultSettings);
    const rankedOld = rankSuggestions([dish], currentMenu, oldHistory, defaultSettings);
    expect(rankedRecent[0].score).toBeLessThan(rankedOld[0].score);
  });
});
