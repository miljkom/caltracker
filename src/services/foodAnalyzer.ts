import * as FileSystem from 'expo-file-system';
import { AnalysisResult, FoodItem, NutrientInfo } from '../types/nutrition';

// ============================================================
// CONFIGURATION
// ============================================================
// Get your FREE API key at: https://aistudio.google.com/apikey
// No credit card needed. 250 requests/day free.
const GEMINI_API_KEY = 'AIzaSyBXuPors9WaHtq0mjPC3Fz9S6GfVkoyQEI';
const GEMINI_MODEL = 'gemini-2.5-flash';
// ============================================================

const ANALYSIS_PROMPT = `You are a nutrition analysis AI. Identify every food item in this photo and estimate its nutritional content.

Respond ONLY with valid JSON (no markdown, no backticks, no explanation):
{
  "items": [
    {
      "name": "Grilled Chicken Breast",
      "portion": "~6 oz / 170g",
      "calories": 280,
      "protein": 53,
      "carbs": 0,
      "fat": 6,
      "fiber": 0,
      "sugar": 0,
      "confidence": 0.85
    }
  ],
  "meal_type": "lunch"
}

Rules:
- Identify ALL distinct food items visible
- Estimate portion sizes from visual cues (plate size, utensils, hands)
- All nutrient values in grams except calories (kcal)
- confidence: 0-1 how certain you are about identification
- meal_type: breakfast/lunch/dinner/snack (infer from food + time context)
- Be as accurate as possible — users rely on this for health tracking`;

const sumNutrients = (items: FoodItem[]): NutrientInfo => ({
  calories: items.reduce((sum, i) => sum + i.calories, 0),
  protein: items.reduce((sum, i) => sum + i.protein, 0),
  carbs: items.reduce((sum, i) => sum + i.carbs, 0),
  fat: items.reduce((sum, i) => sum + i.fat, 0),
  fiber: items.reduce((sum, i) => sum + i.fiber, 0),
  sugar: items.reduce((sum, i) => sum + i.sugar, 0),
});

const guessMealType = (): 'breakfast' | 'lunch' | 'dinner' | 'snack' => {
  const hour = new Date().getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 14) return 'lunch';
  if (hour < 20) return 'dinner';
  return 'snack';
};

const parseResponse = (rawText: string): AnalysisResult => {
  const cleaned = rawText
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  const parsed = JSON.parse(cleaned);

  const items: FoodItem[] = (parsed.items ?? []).map((item: any) => ({
    name: String(item.name ?? 'Unknown'),
    portion: String(item.portion ?? 'unknown'),
    calories: Number(item.calories) || 0,
    protein: Number(item.protein) || 0,
    carbs: Number(item.carbs) || 0,
    fat: Number(item.fat) || 0,
    fiber: Number(item.fiber) || 0,
    sugar: Number(item.sugar) || 0,
    confidence: Number(item.confidence) || 0.5,
  }));

  const mealType = ['breakfast', 'lunch', 'dinner', 'snack'].includes(parsed.meal_type)
    ? parsed.meal_type
    : guessMealType();

  return {
    items,
    totals: sumNutrients(items),
    mealType,
  };
};

// ============================================================
// Gemini Vision API call (FREE tier)
// ============================================================
const analyzeWithGemini = async (base64Image: string): Promise<AnalysisResult> => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image,
              },
            },
            {
              text: ANALYSIS_PROMPT,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (!text) {
    throw new Error('Empty response from Gemini. Try a clearer photo.');
  }

  return parseResponse(text);
};

// ============================================================
// Public API
// ============================================================
export const analyzeFood = async (photoUri: string): Promise<AnalysisResult> => {
  const base64 = await FileSystem.readAsStringAsync(photoUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return analyzeWithGemini(base64);
};
