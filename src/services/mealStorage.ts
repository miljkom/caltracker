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
        totals_json TEXT NOT NULL,
        notes TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_meals_timestamp ON meals(timestamp);
      CREATE TABLE IF NOT EXISTS water_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount INTEGER NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_water_timestamp ON water_log(timestamp);
      CREATE TABLE IF NOT EXISTS favorites (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        meal_type TEXT NOT NULL,
        items_json TEXT NOT NULL,
        totals_json TEXT NOT NULL,
        use_count INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL
      );
    `);
    try {
      await db.execAsync('ALTER TABLE meals ADD COLUMN notes TEXT;');
    } catch {
      // Column already exists — ignore
    }
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
  totals: NutrientInfo,
  notes?: string
): Promise<MealEntry> => {
  const database = await getDb();
  const entry: MealEntry = {
    id: generateId(),
    timestamp: Date.now(),
    photoUri,
    mealType,
    items,
    totals,
    notes,
  };

  await database.runAsync(
    'INSERT INTO meals (id, timestamp, photo_uri, meal_type, items_json, totals_json, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      entry.id,
      entry.timestamp,
      entry.photoUri,
      entry.mealType,
      JSON.stringify(entry.items),
      JSON.stringify(entry.totals),
      entry.notes ?? null,
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
    notes: string | null;
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
    notes: row.notes ?? undefined,
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

export const updateMeal = async (
  id: string,
  items: FoodItem[],
  totals: NutrientInfo
): Promise<void> => {
  const database = await getDb();
  await database.runAsync(
    'UPDATE meals SET items_json = ?, totals_json = ? WHERE id = ?',
    [JSON.stringify(items), JSON.stringify(totals), id]
  );
};

export const deleteMeal = async (id: string): Promise<void> => {
  const database = await getDb();
  await database.runAsync('DELETE FROM meals WHERE id = ?', [id]);
};

export const getLoggingStreak = async (): Promise<number> => {
  const database = await getDb();
  // Get distinct dates (as yyyy-mm-dd) that have meals, ordered descending
  const rows = await database.getAllAsync<{ day: string }>(
    `SELECT DISTINCT DATE(timestamp / 1000, 'unixepoch', 'localtime') as day
     FROM meals ORDER BY day DESC`
  );

  if (rows.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < rows.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().split('T')[0];

    if (rows[i].day === expectedStr) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
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
    notes: string | null;
  }>('SELECT * FROM meals ORDER BY timestamp DESC LIMIT ?', [limit]);

  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    photoUri: row.photo_uri,
    mealType: row.meal_type as MealEntry['mealType'],
    items: JSON.parse(row.items_json),
    totals: JSON.parse(row.totals_json),
    notes: row.notes ?? undefined,
  }));
};

// ---- Weekly totals ----

export const getWeeklyTotals = async (): Promise<{ date: string; calories: number; protein: number; carbs: number; fat: number }[]> => {
  const database = await getDb();
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const rows = await database.getAllAsync<{
    day: string;
    totals_json: string;
  }>(
    `SELECT DATE(timestamp / 1000, 'unixepoch', 'localtime') as day, totals_json
     FROM meals WHERE timestamp >= ? ORDER BY timestamp`,
    [sevenDaysAgo.getTime()]
  );

  // Aggregate by day
  const dayMap = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
  for (const row of rows) {
    const t = JSON.parse(row.totals_json);
    const existing = dayMap.get(row.day) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    dayMap.set(row.day, {
      calories: existing.calories + (t.calories || 0),
      protein: existing.protein + (t.protein || 0),
      carbs: existing.carbs + (t.carbs || 0),
      fat: existing.fat + (t.fat || 0),
    });
  }

  // Build 7-day array
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const results: { date: string; calories: number; protein: number; carbs: number; fat: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const key = day.toISOString().split('T')[0];
    const data = dayMap.get(key) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    results.push({ date: dayNames[day.getDay()], ...data });
  }

  return results;
};

// ---- Favorites ----

export const addFavorite = async (
  name: string,
  mealType: string,
  items: FoodItem[],
  totals: NutrientInfo
): Promise<void> => {
  const database = await getDb();
  const id = `fav_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  await database.runAsync(
    'INSERT INTO favorites (id, name, meal_type, items_json, totals_json, use_count, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
    [id, name, mealType, JSON.stringify(items), JSON.stringify(totals), Date.now()]
  );
};

export const getFavorites = async (limit: number = 10): Promise<{
  id: string;
  name: string;
  mealType: string;
  items: FoodItem[];
  totals: NutrientInfo;
}[]> => {
  const database = await getDb();
  const rows = await database.getAllAsync<{
    id: string;
    name: string;
    meal_type: string;
    items_json: string;
    totals_json: string;
  }>('SELECT * FROM favorites ORDER BY use_count DESC, created_at DESC LIMIT ?', [limit]);

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    mealType: row.meal_type,
    items: JSON.parse(row.items_json),
    totals: JSON.parse(row.totals_json),
  }));
};

export const useFavorite = async (id: string): Promise<void> => {
  const database = await getDb();
  await database.runAsync('UPDATE favorites SET use_count = use_count + 1 WHERE id = ?', [id]);
};

export const deleteFavorite = async (id: string): Promise<void> => {
  const database = await getDb();
  await database.runAsync('DELETE FROM favorites WHERE id = ?', [id]);
};

// ---- Water tracking ----

export const logWater = async (amount: number): Promise<void> => {
  const database = await getDb();
  await database.runAsync(
    'INSERT INTO water_log (amount, timestamp) VALUES (?, ?)',
    [amount, Date.now()]
  );
};

export const getWaterForDay = async (date: Date): Promise<number> => {
  const database = await getDb();
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const row = await database.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0) as total FROM water_log WHERE timestamp >= ? AND timestamp <= ?',
    [startOfDay.getTime(), endOfDay.getTime()]
  );
  return row?.total ?? 0;
};
