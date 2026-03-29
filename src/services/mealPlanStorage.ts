import * as SQLite from 'expo-sqlite';
import { FoodItem, NutrientInfo } from '../types/nutrition';
import { PlannedMeal, MealPlan, MealSuggestionCard } from '../types/mealPlan';

const DB_NAME = 'calorie_tracker.db';

let db: SQLite.SQLiteDatabase | null = null;

const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS meal_plans (
        id TEXT PRIMARY KEY,
        target_date TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS planned_meals (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        meal_type TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        items_json TEXT NOT NULL,
        totals_json TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_planned_meals_plan ON planned_meals(plan_id);
      CREATE TABLE IF NOT EXISTS meal_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        food_name TEXT NOT NULL,
        feedback TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
  }
  return db;
};

const generateId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

// ---- Plans ----

export const getOrCreatePlan = async (targetDate: string): Promise<MealPlan> => {
  const database = await getDb();

  const existing = await database.getFirstAsync<{
    id: string;
    target_date: string;
    created_at: number;
    updated_at: number;
  }>('SELECT * FROM meal_plans WHERE target_date = ?', [targetDate]);

  if (existing) {
    const meals = await getPlanMeals(existing.id);
    return {
      id: existing.id,
      targetDate: existing.target_date,
      meals,
      createdAt: existing.created_at,
      updatedAt: existing.updated_at,
    };
  }

  const now = Date.now();
  const id = generateId('plan');
  await database.runAsync(
    'INSERT INTO meal_plans (id, target_date, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [id, targetDate, now, now]
  );

  return { id, targetDate, meals: [], createdAt: now, updatedAt: now };
};

const getPlanMeals = async (planId: string): Promise<PlannedMeal[]> => {
  const database = await getDb();
  const rows = await database.getAllAsync<{
    id: string;
    plan_id: string;
    meal_type: string;
    name: string;
    description: string | null;
    items_json: string;
    totals_json: string;
    sort_order: number;
    created_at: number;
  }>('SELECT * FROM planned_meals WHERE plan_id = ? ORDER BY sort_order, created_at', [planId]);

  return rows.map((r) => ({
    id: r.id,
    planId: r.plan_id,
    mealType: r.meal_type as PlannedMeal['mealType'],
    name: r.name,
    description: r.description ?? '',
    items: JSON.parse(r.items_json),
    totals: JSON.parse(r.totals_json),
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }));
};

export const getPlanForDate = async (targetDate: string): Promise<MealPlan | null> => {
  const database = await getDb();
  const row = await database.getFirstAsync<{
    id: string;
    target_date: string;
    created_at: number;
    updated_at: number;
  }>('SELECT * FROM meal_plans WHERE target_date = ?', [targetDate]);

  if (!row) return null;

  const meals = await getPlanMeals(row.id);
  return {
    id: row.id,
    targetDate: row.target_date,
    meals,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

// ---- Planned meals ----

const MEAL_TYPE_ORDER: Record<string, number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
  snack: 3,
};

export const addMealToPlan = async (
  planId: string,
  suggestion: MealSuggestionCard
): Promise<PlannedMeal> => {
  const database = await getDb();
  const id = generateId('pm');
  const now = Date.now();
  const sortOrder = MEAL_TYPE_ORDER[suggestion.mealType] ?? 3;

  await database.runAsync(
    'INSERT INTO planned_meals (id, plan_id, meal_type, name, description, items_json, totals_json, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      planId,
      suggestion.mealType,
      suggestion.name,
      suggestion.description,
      JSON.stringify(suggestion.items),
      JSON.stringify(suggestion.totals),
      sortOrder,
      now,
    ]
  );

  await database.runAsync('UPDATE meal_plans SET updated_at = ? WHERE id = ?', [now, planId]);

  return {
    id,
    planId,
    mealType: suggestion.mealType,
    name: suggestion.name,
    description: suggestion.description,
    items: suggestion.items,
    totals: suggestion.totals,
    sortOrder,
    createdAt: now,
  };
};

export const removeMealFromPlan = async (mealId: string): Promise<void> => {
  const database = await getDb();
  await database.runAsync('DELETE FROM planned_meals WHERE id = ?', [mealId]);
};

export const clearPlan = async (planId: string): Promise<void> => {
  const database = await getDb();
  await database.runAsync('DELETE FROM planned_meals WHERE plan_id = ?', [planId]);
  await database.runAsync('UPDATE meal_plans SET updated_at = ? WHERE id = ?', [Date.now(), planId]);
};

// ---- User preferences / feedback ----

export const saveFeedback = async (foodName: string, feedback: string): Promise<void> => {
  const database = await getDb();
  await database.runAsync(
    'INSERT INTO meal_preferences (food_name, feedback, created_at) VALUES (?, ?, ?)',
    [foodName, feedback, Date.now()]
  );
};

export const getRecentFeedback = async (limit: number = 20): Promise<{ foodName: string; feedback: string }[]> => {
  const database = await getDb();
  const rows = await database.getAllAsync<{ food_name: string; feedback: string }>(
    'SELECT food_name, feedback FROM meal_preferences ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
  return rows.map((r) => ({ foodName: r.food_name, feedback: r.feedback }));
};

export const getPlanTotals = (meals: PlannedMeal[]): NutrientInfo => ({
  calories: meals.reduce((s, m) => s + m.totals.calories, 0),
  protein: meals.reduce((s, m) => s + m.totals.protein, 0),
  carbs: meals.reduce((s, m) => s + m.totals.carbs, 0),
  fat: meals.reduce((s, m) => s + m.totals.fat, 0),
  fiber: meals.reduce((s, m) => s + m.totals.fiber, 0),
  sugar: meals.reduce((s, m) => s + m.totals.sugar, 0),
});
