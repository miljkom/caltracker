import * as SQLite from 'expo-sqlite';
import { MealEntry, DailyTotals, NutrientInfo, FoodItem } from '../types/nutrition';

const DB_NAME = 'calorie_tracker.db';

let db: SQLite.SQLiteDatabase | null = null;

const getDb = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS meals (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        photo_uri TEXT,
        meal_type TEXT NOT NULL,
        items_json TEXT NOT NULL,
        totals_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_meals_timestamp ON meals(timestamp);
    `);
  }
  return db;
};

const generateId = (): string =>
  `meal_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

// ---- CRUD ----

export const saveMeal = async (
  photoUri: string | null,
  mealType: MealEntry['mealType'],
  items: FoodItem[],
  totals: NutrientInfo
): Promise<MealEntry> => {
  const database = await getDb();
  const entry: MealEntry = {
    id: generateId(),
    timestamp: Date.now(),
    photoUri,
    mealType,
    items,
    totals,
  };

  await database.runAsync(
    'INSERT INTO meals (id, timestamp, photo_uri, meal_type, items_json, totals_json) VALUES (?, ?, ?, ?, ?, ?)',
    [
      entry.id,
      entry.timestamp,
      entry.photoUri,
      entry.mealType,
      JSON.stringify(entry.items),
      JSON.stringify(entry.totals),
    ]
  );

  return entry;
};

export const getMealsForDay = async (date: Date): Promise<MealEntry[]> => {
  const database = await getDb();

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const rows = await database.getAllAsync<{
    id: string;
    timestamp: number;
    photo_uri: string | null;
    meal_type: string;
    items_json: string;
    totals_json: string;
  }>(
    'SELECT * FROM meals WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp DESC',
    [startOfDay.getTime(), endOfDay.getTime()]
  );

  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    photoUri: row.photo_uri,
    mealType: row.meal_type as MealEntry['mealType'],
    items: JSON.parse(row.items_json),
    totals: JSON.parse(row.totals_json),
  }));
};

export const getDailyTotals = async (date: Date): Promise<DailyTotals> => {
  const meals = await getMealsForDay(date);

  const empty: DailyTotals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    meals: 0,
  };

  return meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.totals.calories,
      protein: acc.protein + meal.totals.protein,
      carbs: acc.carbs + meal.totals.carbs,
      fat: acc.fat + meal.totals.fat,
      fiber: acc.fiber + meal.totals.fiber,
      sugar: acc.sugar + meal.totals.sugar,
      meals: acc.meals + 1,
    }),
    empty
  );
};

export const deleteMeal = async (id: string): Promise<void> => {
  const database = await getDb();
  await database.runAsync('DELETE FROM meals WHERE id = ?', [id]);
};

export const getRecentMeals = async (limit: number = 20): Promise<MealEntry[]> => {
  const database = await getDb();

  const rows = await database.getAllAsync<{
    id: string;
    timestamp: number;
    photo_uri: string | null;
    meal_type: string;
    items_json: string;
    totals_json: string;
  }>('SELECT * FROM meals ORDER BY timestamp DESC LIMIT ?', [limit]);

  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    photoUri: row.photo_uri,
    mealType: row.meal_type as MealEntry['mealType'],
    items: JSON.parse(row.items_json),
    totals: JSON.parse(row.totals_json),
  }));
};
