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
