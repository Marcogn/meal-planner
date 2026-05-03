import type {
  WeeklyMenu,
  Dish,
  FrequencyConstraint,
  ConstraintViolation,
  ProteinCategory,
} from './types';

export function validateWeek(
  menu: WeeklyMenu,
  dishes: Dish[],
  constraints: FrequencyConstraint[]
): ConstraintViolation[] {
  const dishMap = new Map(dishes.map((d) => [d.id, d]));
  const categoryCounts = new Map<ProteinCategory, number>();

  for (const meal of menu.meals) {
    const dish = dishMap.get(meal.dishId);
    if (!dish) continue;
    for (const cat of dish.proteinCategories) {
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
    }
  }

  const violations: ConstraintViolation[] = [];

  for (const constraint of constraints) {
    const count = categoryCounts.get(constraint.category) ?? 0;
    if (constraint.maxPerWeek !== undefined && count > constraint.maxPerWeek) {
      violations.push({
        type: 'OVER_MAX',
        category: constraint.category,
        current: count,
        threshold: constraint.maxPerWeek,
      });
    }
    if (constraint.minPerWeek !== undefined && count < constraint.minPerWeek) {
      violations.push({
        type: 'UNDER_MIN',
        category: constraint.category,
        current: count,
        threshold: constraint.minPerWeek,
      });
    }
  }

  return violations;
}
