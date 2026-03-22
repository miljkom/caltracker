import { NutrientInfo, DailyTotals, MealEntry } from '../types/nutrition';
import { DailyGoals } from '../types/nutrition';

// Use Gemma (text-only, 14.4K/day) for suggestions via Gemini API
import Constants from 'expo-constants';

const GEMINI_API_KEY = Constants.expoConfig?.extra?.geminiApiKey ?? '';

const TEXT_MODELS = [
  'gemma-3-27b-it',
  'gemma-3-12b-it',
  'gemini-2.5-flash-lite',
];

interface MealSuggestion {
  mealType: string;
  name: string;
  description: string;
  approxCalories: number;
}

const callTextModel = async (prompt: string): Promise<string> => {
  for (const model of TEXT_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      });
      if (response.status === 429 || response.status === 403) continue;
      if (!response.ok) continue;

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    } catch {
      continue;
    }
  }
  return '';
};

// Cache to avoid re-querying on every tab switch
let cachedSuggestions: MealSuggestion[] = [];
let cacheKey = '';

export const getMealSuggestions = async (
  totals: DailyTotals,
  goals: DailyGoals,
  recentMeals: MealEntry[]
): Promise<MealSuggestion[]> => {
  // Simple cache: only regenerate if totals changed significantly
  const key = `${Math.round(totals.calories / 50)}-${totals.meals}-${new Date().getHours()}`;
  if (key === cacheKey && cachedSuggestions.length > 0) {
    return cachedSuggestions;
  }

  const remaining = {
    calories: Math.max(0, goals.calories - totals.calories),
    protein: Math.max(0, goals.protein - totals.protein),
    carbs: Math.max(0, goals.carbs - totals.carbs),
    fat: Math.max(0, goals.fat - totals.fat),
  };

  if (remaining.calories <= 0) {
    cachedSuggestions = [];
    cacheKey = key;
    return [];
  }

  const hour = new Date().getHours();
  let nextMeal = 'snack';
  if (hour < 10) nextMeal = 'breakfast';
  else if (hour < 14) nextMeal = 'lunch';
  else if (hour < 20) nextMeal = 'dinner';

  const recentFoods = recentMeals
    .slice(0, 5)
    .flatMap(m => m.items.map(i => i.name))
    .join(', ');

  const prompt = `You are a nutrition coach. Suggest 2-3 specific meal ideas for ${nextMeal}.

The user needs approximately:
- ${Math.round(remaining.calories)} more calories
- ${Math.round(remaining.protein)}g more protein
- ${Math.round(remaining.carbs)}g more carbs
- ${Math.round(remaining.fat)}g more fat

They recently ate: ${recentFoods || 'nothing logged yet today'}

Respond ONLY with valid JSON (no markdown, no backticks):
[
  {
    "mealType": "${nextMeal}",
    "name": "Meal name",
    "description": "Brief description with key ingredients",
    "approxCalories": 400
  }
]

Rules:
- Suggest real, practical meals people can easily make or order
- Match the calorie/macro budget closely
- Avoid repeating what they already ate today
- Keep descriptions short (under 15 words)
- Include variety (don't suggest 3 chicken dishes)`;

  try {
    const text = await callTextModel(prompt);
    if (!text) {
      cachedSuggestions = [];
      cacheKey = key;
      return [];
    }

    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    cachedSuggestions = (Array.isArray(parsed) ? parsed : []).map((s: any) => ({
      mealType: String(s.mealType ?? nextMeal),
      name: String(s.name ?? 'Meal'),
      description: String(s.description ?? ''),
      approxCalories: Number(s.approxCalories) || 0,
    })).slice(0, 3);

    cacheKey = key;
    return cachedSuggestions;
  } catch {
    cachedSuggestions = [];
    cacheKey = key;
    return [];
  }
};

// Recipe cache
const recipeCache = new Map<string, string>();

// Get a full recipe for a suggested meal
export const getRecipe = async (mealName: string, approxCalories: number): Promise<string> => {
  const cacheKey = `${mealName.toLowerCase()}-${approxCalories}`;
  if (recipeCache.has(cacheKey)) return recipeCache.get(cacheKey)!;
  const prompt = `Give me a simple recipe for "${mealName}" (approximately ${approxCalories} calories per serving).

Format your response as plain text (NOT JSON, NOT markdown):

INGREDIENTS
- ingredient 1
- ingredient 2
...

INSTRUCTIONS
1. Step one
2. Step two
...

NUTRITION (per serving)
Calories: X kcal
Protein: Xg | Carbs: Xg | Fat: Xg

Keep it concise — max 5-7 ingredients, 4-6 steps. Use common household ingredients. Include prep time at the start like "Prep: 10 min | Cook: 15 min"`;

  const text = await callTextModel(prompt);
  if (!text) throw new Error('Could not generate recipe. Try again.');
  const result = text.trim();
  recipeCache.set(cacheKey, result);
  return result;
};
