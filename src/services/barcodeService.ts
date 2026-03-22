import { FoodItem, NutrientInfo, AnalysisResult } from '../types/nutrition';

const OPEN_FOOD_FACTS_URL = 'https://world.openfoodfacts.org/api/v2/product';

export const lookupBarcode = async (barcode: string): Promise<AnalysisResult | null> => {
  try {
    const response = await fetch(`${OPEN_FOOD_FACTS_URL}/${barcode}.json`);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.status !== 1 || !data.product) return null;

    const product = data.product;
    const nutriments = product.nutriments ?? {};

    // Get per-serving values, fall back to per-100g
    const servingSize = product.serving_size ?? '100g';
    const useServing = nutriments['energy-kcal_serving'] != null;

    const item: FoodItem = {
      name: product.product_name ?? product.generic_name ?? 'Unknown Product',
      portion: servingSize,
      calories: Math.round(useServing ? (nutriments['energy-kcal_serving'] ?? 0) : (nutriments['energy-kcal_100g'] ?? 0)),
      protein: Math.round(useServing ? (nutriments.proteins_serving ?? 0) : (nutriments.proteins_100g ?? 0)),
      carbs: Math.round(useServing ? (nutriments.carbohydrates_serving ?? 0) : (nutriments.carbohydrates_100g ?? 0)),
      fat: Math.round(useServing ? (nutriments.fat_serving ?? 0) : (nutriments.fat_100g ?? 0)),
      fiber: Math.round(useServing ? (nutriments.fiber_serving ?? 0) : (nutriments.fiber_100g ?? 0)),
      sugar: Math.round(useServing ? (nutriments.sugars_serving ?? 0) : (nutriments.sugars_100g ?? 0)),
      confidence: 0.95,
    };

    const guessMealType = (): 'breakfast' | 'lunch' | 'dinner' | 'snack' => {
      const hour = new Date().getHours();
      if (hour < 10) return 'breakfast';
      if (hour < 14) return 'lunch';
      if (hour < 20) return 'dinner';
      return 'snack';
    };

    return {
      items: [item],
      totals: {
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        fiber: item.fiber,
        sugar: item.sugar,
      },
      mealType: guessMealType(),
    };
  } catch {
    return null;
  }
};
