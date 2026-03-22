import * as SQLite from 'expo-sqlite';
import { FoodItem } from '../types/nutrition';

const DB_NAME = 'calorie_tracker.db';

let cacheDb: SQLite.SQLiteDatabase | null = null;

const getDb = async () => {
  if (!cacheDb) {
    cacheDb = await SQLite.openDatabaseAsync(DB_NAME);
    await cacheDb.execAsync(`
      CREATE TABLE IF NOT EXISTS food_cache (
        name TEXT PRIMARY KEY,
        item_json TEXT NOT NULL,
        hits INTEGER DEFAULT 1,
        updated_at INTEGER NOT NULL
      );
    `);
  }
  return cacheDb;
};

export const getCachedFood = async (name: string): Promise<FoodItem | null> => {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ item_json: string }>(
      'SELECT item_json FROM food_cache WHERE LOWER(name) = LOWER(?)',
      [name.trim()]
    );
    if (row) {
      // Increment hit count
      await db.runAsync('UPDATE food_cache SET hits = hits + 1 WHERE LOWER(name) = LOWER(?)', [name.trim()]);
      return JSON.parse(row.item_json);
    }
  } catch {}
  return null;
};

export const cacheFood = async (item: FoodItem): Promise<void> => {
  try {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO food_cache (name, item_json, hits, updated_at) VALUES (?, ?, COALESCE((SELECT hits FROM food_cache WHERE LOWER(name) = LOWER(?)), 0) + 1, ?)',
      [item.name.trim(), JSON.stringify(item), item.name.trim(), Date.now()]
    );
  } catch {}
};

export const cacheFoodItems = async (items: FoodItem[]): Promise<void> => {
  for (const item of items) {
    await cacheFood(item);
  }
};
