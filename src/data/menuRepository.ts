import { db, type MealRecord } from './db';
import type { Meal, WeeklyMenu } from '../domain/types';

function getIsoWeek(dateStr: string): string {
  const d = new Date(dateStr);
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = d.getTime() - startOfWeek1.getTime();
  const weekNum = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export async function getMenuForWeek(isoWeek: string): Promise<WeeklyMenu> {
  const records = await db.meals.where('isoWeek').equals(isoWeek).toArray();
  return {
    isoWeek,
    meals: records.map(({ isoWeek: _w, ...meal }) => meal as Meal),
  };
}

export async function getAllMenus(): Promise<WeeklyMenu[]> {
  const records = await db.meals.toArray();
  const byWeek = new Map<string, Meal[]>();
  for (const { isoWeek, ...meal } of records) {
    const list = byWeek.get(isoWeek) ?? [];
    list.push(meal as Meal);
    byWeek.set(isoWeek, list);
  }
  return Array.from(byWeek.entries()).map(([isoWeek, meals]) => ({ isoWeek, meals }));
}

export async function saveMeal(meal: Meal): Promise<void> {
  const record: MealRecord = { ...meal, isoWeek: getIsoWeek(meal.date) };
  await db.meals.put(record);
}

export async function deleteMeal(id: string): Promise<void> {
  await db.meals.delete(id);
}

export async function bulkPutMenus(menus: WeeklyMenu[]): Promise<void> {
  const records: MealRecord[] = menus.flatMap((menu) =>
    menu.meals.map((m) => ({ ...m, isoWeek: menu.isoWeek }))
  );
  await db.meals.bulkPut(records);
}
