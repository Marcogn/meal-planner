export type ProteinCategory =
  | 'CARNE_ROSSA'
  | 'CARNE_BIANCA'
  | 'PESCE'
  | 'LEGUMI'
  | 'UOVA'
  | 'FORMAGGIO'
  | 'CEREALI'
  | 'ALTRO';

export type MealSlot = 'PRANZO' | 'CENA';

export interface Dish {
  id: string;
  name: string;
  proteinCategories: ProteinCategory[];
  tags: string[];
  notes?: string;
  createdAt: string;
}

export interface Meal {
  id: string;
  dishId: string;
  date: string;
  slot: MealSlot;
}

export interface WeeklyMenu {
  isoWeek: string;
  meals: Meal[];
}

export interface FrequencyConstraint {
  category: ProteinCategory;
  minPerWeek?: number;
  maxPerWeek?: number;
}

export interface Settings {
  constraints: FrequencyConstraint[];
  recencyWindowWeeks: number;
}

export type ViolationType = 'UNDER_MIN' | 'OVER_MAX';

export interface ConstraintViolation {
  type: ViolationType;
  category: ProteinCategory;
  current: number;
  threshold: number;
}

export interface ScoredDish {
  dish: Dish;
  score: number;
}
