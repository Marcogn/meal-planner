import type { Dish, WeeklyMenu, Settings, ScoredDish, ProteinCategory } from './types';

function countCategoryInMenu(
  menu: WeeklyMenu,
  dishMap: Map<string, Dish>,
  category: ProteinCategory
): number {
  let count = 0;
  for (const meal of menu.meals) {
    const dish = dishMap.get(meal.dishId);
    if (dish?.proteinCategories.includes(category)) count++;
  }
  return count;
}

// Convert "YYYY-Www" to a comparable integer (year * 53 + week).
function weekOrdinal(isoWeek: string): number {
  const [yearStr, weekStr] = isoWeek.split('-W');
  return Number(yearStr) * 53 + Number(weekStr);
}

export function rankSuggestions(
  dishes: Dish[],
  currentMenu: WeeklyMenu,
  history: WeeklyMenu[],
  settings: Settings
): ScoredDish[] {
  const { constraints, recencyWindowWeeks } = settings;
  const dishMap = new Map(dishes.map((d) => [d.id, d]));
  const currentOrdinal = weekOrdinal(currentMenu.isoWeek);

  // Build map: dishId → most recent past week-ordinal it was used
  const lastUsedOrdinal = new Map<string, number>();
  for (const menu of history) {
    const ord = weekOrdinal(menu.isoWeek);
    if (ord >= currentOrdinal) continue;
    for (const meal of menu.meals) {
      const prev = lastUsedOrdinal.get(meal.dishId);
      if (prev === undefined || ord > prev) lastUsedOrdinal.set(meal.dishId, ord);
    }
  }

  const results: ScoredDish[] = [];

  for (const dish of dishes) {
    // Exclude dishes that would push any maxPerWeek over the limit
    let wouldViolateMax = false;
    for (const c of constraints) {
      if (c.maxPerWeek === undefined) continue;
      const current = countCategoryInMenu(currentMenu, dishMap, c.category);
      if (dish.proteinCategories.includes(c.category) && current >= c.maxPerWeek) {
        wouldViolateMax = true;
        break;
      }
    }
    if (wouldViolateMax) continue;

    let score = 0;

    // Bonus for covering an unmet minPerWeek
    for (const c of constraints) {
      if (c.minPerWeek === undefined) continue;
      const current = countCategoryInMenu(currentMenu, dishMap, c.category);
      if (dish.proteinCategories.includes(c.category) && current < c.minPerWeek) {
        score += 10;
      }
    }

    // Linear recency penalty: max when weeksAgo=1, zero at recencyWindowWeeks
    const lastOrd = lastUsedOrdinal.get(dish.id);
    if (lastOrd !== undefined) {
      const weeksAgo = currentOrdinal - lastOrd;
      if (weeksAgo > 0 && weeksAgo <= recencyWindowWeeks) {
        const maxPenalty = 5;
        const penalty =
          maxPenalty * (1 - (weeksAgo - 1) / Math.max(recencyWindowWeeks - 1, 1));
        score -= penalty;
      }
    }

    results.push({ dish, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}
