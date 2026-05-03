import { describe, it, expect } from 'vitest';
import { validateWeek } from '../validator';
import type { Dish, WeeklyMenu, FrequencyConstraint } from '../types';

function makeDish(id: string, cats: string[]): Dish {
  return {
    id,
    name: `Dish ${id}`,
    proteinCategories: cats as Dish['proteinCategories'],
    tags: [],
    createdAt: new Date().toISOString(),
  };
}

function makeMenu(meals: { dishId: string }[]): WeeklyMenu {
  return {
    isoWeek: '2026-W18',
    meals: meals.map((m, i) => ({
      id: `meal-${i}`,
      dishId: m.dishId,
      date: '2026-04-27',
      slot: i % 2 === 0 ? 'PRANZO' : 'CENA',
    })),
  };
}

describe('validateWeek', () => {
  it('settimana vuota con vincoli min → tutti UNDER_MIN', () => {
    const menu = makeMenu([]);
    const constraints: FrequencyConstraint[] = [
      { category: 'PESCE', minPerWeek: 2 },
      { category: 'LEGUMI', minPerWeek: 1 },
    ];
    const violations = validateWeek(menu, [], constraints);
    expect(violations).toHaveLength(2);
    expect(violations.every((v) => v.type === 'UNDER_MIN')).toBe(true);
  });

  it('categoria oltre maxPerWeek → OVER_MAX', () => {
    const dish = makeDish('d1', ['CARNE_ROSSA']);
    const menu = makeMenu([{ dishId: 'd1' }, { dishId: 'd1' }, { dishId: 'd1' }]);
    const constraints: FrequencyConstraint[] = [{ category: 'CARNE_ROSSA', maxPerWeek: 2 }];
    const violations = validateWeek(menu, [dish], constraints);
    expect(violations).toHaveLength(1);
    expect(violations[0].type).toBe('OVER_MAX');
    expect(violations[0].current).toBe(3);
    expect(violations[0].threshold).toBe(2);
  });

  it('vincolo soddisfatto → nessuna violazione', () => {
    const dish = makeDish('d1', ['PESCE']);
    const menu = makeMenu([{ dishId: 'd1' }, { dishId: 'd1' }]);
    const constraints: FrequencyConstraint[] = [{ category: 'PESCE', minPerWeek: 2, maxPerWeek: 3 }];
    const violations = validateWeek(menu, [dish], constraints);
    expect(violations).toHaveLength(0);
  });

  it('piatto multi-categoria conta per ogni categoria dichiarata', () => {
    const dish = makeDish('d1', ['UOVA', 'FORMAGGIO']);
    const menu = makeMenu([{ dishId: 'd1' }]);
    const constraints: FrequencyConstraint[] = [
      { category: 'UOVA', maxPerWeek: 0 },
      { category: 'FORMAGGIO', maxPerWeek: 0 },
    ];
    const violations = validateWeek(menu, [dish], constraints);
    expect(violations).toHaveLength(2);
    expect(violations.map((v) => v.category).sort()).toEqual(['FORMAGGIO', 'UOVA'].sort());
  });
});
