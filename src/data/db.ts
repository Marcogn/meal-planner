import Dexie, { type Table } from 'dexie';
import type { Dish, Meal, Settings } from '../domain/types';

export interface MealRecord extends Meal {
  isoWeek: string;
}

export class MenuPlannerDB extends Dexie {
  dishes!: Table<Dish>;
  meals!: Table<MealRecord>;
  settings!: Table<Settings & { id: number }>;

  constructor() {
    super('MenuPlannerDB');
    this.version(1).stores({
      dishes: 'id, name, createdAt',
      meals: 'id, dishId, date, slot, isoWeek',
      settings: 'id',
    });
  }
}

export const db = new MenuPlannerDB();
