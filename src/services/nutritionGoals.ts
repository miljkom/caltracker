import * as SQLite from 'expo-sqlite';
import { DailyGoals } from '../types/nutrition';

// Default daily goals — users can customize these
export const DEFAULT_GOALS: DailyGoals = {
  calories: 2000,
  protein: 150,  // grams
  carbs: 250,    // grams
  fat: 65,       // grams
  fiber: 30,     // grams
  sugar: 50,     // grams
};

const DB_NAME = 'calorie_tracker.db';

const ensureSettingsTable = async (db: SQLite.SQLiteDatabase) => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
};

export const loadGoals = async (): Promise<DailyGoals> => {
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await ensureSettingsTable(db);
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      ['daily_goals']
    );
    if (row) {
      return JSON.parse(row.value) as DailyGoals;
    }
  } catch (e) {
    console.warn('Failed to load goals, using defaults:', e);
  }
  return { ...DEFAULT_GOALS };
};

export const saveGoals = async (goals: DailyGoals): Promise<void> => {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await ensureSettingsTable(db);
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['daily_goals', JSON.stringify(goals)]
  );
};

export const MEAL_TYPE_ICONS: Record<string, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍿',
};

export const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export const NUTRIENT_COLORS: Record<string, string> = {
  calories: '#FF6B35',
  protein: '#4ECDC4',
  carbs: '#FFD93D',
  fat: '#FF6B6B',
  fiber: '#95D5B2',
  sugar: '#DDA0DD',
};
