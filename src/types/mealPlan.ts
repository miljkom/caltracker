import { FoodItem, NutrientInfo } from './nutrition';

export interface MealSuggestionCard {
  name: string;
  description: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  items: FoodItem[];
  totals: NutrientInfo;
  tags: string[];
}

export interface PlannedMeal {
  id: string;
  planId: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  description: string;
  items: FoodItem[];
  totals: NutrientInfo;
  sortOrder: number;
  createdAt: number;
}

export interface MealPlan {
  id: string;
  targetDate: string; // ISO date e.g. '2026-03-30'
  meals: PlannedMeal[];
  createdAt: number;
  updatedAt: number;
}

export interface SuggestionContext {
  remainingCalories: number;
  remainingProtein: number;
  remainingCarbs: number;
  remainingFat: number;
  alreadyPlanned: string[];
  favoriteNames: string[];
  recentFoodNames: string[];
  targetMealTypes: string[];
  userFeedback: string[];
}
