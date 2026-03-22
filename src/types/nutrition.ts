export interface NutrientInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
}

export interface FoodItem extends NutrientInfo {
  name: string;
  portion: string;
  confidence: number;
}

export interface MealEntry {
  id: string;
  timestamp: number;
  photoUri: string | null;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  items: FoodItem[];
  totals: NutrientInfo;
}

export interface DailyTotals extends NutrientInfo {
  meals: number;
}

export interface DailyGoals extends NutrientInfo {}

export interface AnalysisResult {
  items: FoodItem[];
  totals: NutrientInfo;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}
