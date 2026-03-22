// Widget Data Service
// ===================
// Prepares daily progress data for home screen widgets.
//
// To implement native widgets:
// iOS: Add a Widget Extension target, read from shared UserDefaults
// Android: Add an AppWidgetProvider, read from SharedPreferences
//
// This service provides the getWidgetData() function that returns
// all the data a widget needs. When adding native widget code,
// call this function and write the result to shared storage.

import { getDailyTotals } from './mealStorage';
import { loadGoals } from './nutritionGoals';
import { getWaterForDay } from './mealStorage';
import { loadWaterGoal } from './nutritionGoals';

export interface WidgetData {
  calories: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number;
  water: number;
  waterGoal: number;
  meals: number;
  date: string;
}

export const getWidgetData = async (): Promise<WidgetData> => {
  const today = new Date();
  const [totals, goals, water, waterGoal] = await Promise.all([
    getDailyTotals(today),
    loadGoals(),
    getWaterForDay(today),
    loadWaterGoal(),
  ]);

  return {
    calories: Math.round(totals.calories),
    calorieGoal: goals.calories,
    protein: Math.round(totals.protein),
    proteinGoal: goals.protein,
    water,
    waterGoal,
    meals: totals.meals,
    date: today.toISOString().split('T')[0],
  };
};
