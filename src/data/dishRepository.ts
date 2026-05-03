import { db } from './db';
import type { Dish } from '../domain/types';

export async function getAllDishes(): Promise<Dish[]> {
  return db.dishes.orderBy('createdAt').toArray();
}

export async function saveDish(dish: Dish): Promise<void> {
  await db.dishes.put(dish);
}

export async function deleteDish(id: string): Promise<void> {
  await db.dishes.delete(id);
}

export async function bulkPutDishes(dishes: Dish[]): Promise<void> {
  await db.dishes.bulkPut(dishes);
}
