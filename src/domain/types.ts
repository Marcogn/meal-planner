export type ID = string; // UUID v4

export type FrequencyLimit = 1 | 2 | 3 | 4 | 5 | 'unlimited';

export interface Element {
  id: ID;
  name: string; // "formaggio", "carne rossa", "verdura"
  maxFrequencyPerWeek: FrequencyLimit;
  createdAt: number;
  updatedAt: number;
}

export type MealType =
  | 'colazione'
  | 'merenda_mattina'
  | 'pranzo'
  | 'merenda_pomeriggio'
  | 'cena';

export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1=lun, 7=dom

export interface Dish {
  id: ID;
  name: string; // testo libero (es. "mozzarella e insalata con pane")
  elementIds: ID[]; // riferimenti agli Elementi (categorie)
}

export interface MealSlot {
  day: DayOfWeek;
  meal: MealType;
  dishes: Dish[]; // tipicamente uno
}

export interface Week {
  id: ID; // formato "YYYY-Www" (ISO week)
  isoWeekStart: string; // "2026-05-04" (lunedì della settimana)
  slots: MealSlot[];
  updatedAt: number;
}
