import Constants from 'expo-constants';
import { FoodItem, NutrientInfo } from '../types/nutrition';
import { MealSuggestionCard, SuggestionContext } from '../types/mealPlan';

const GROQ_API_KEY = Constants.expoConfig?.extra?.groqApiKey ?? '';

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
];

const callTextModel = async (prompt: string): Promise<string> => {
  if (!GROQ_API_KEY) return '';

  for (const model of GROQ_MODELS) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8,
          max_tokens: 4096,
        }),
      });
      if (response.status === 429) continue;
      if (!response.ok) continue;

      const data = await response.json();
      return data.choices?.[0]?.message?.content ?? '';
    } catch {
      continue;
    }
  }
  return '';
};

let cachedBatch: MealSuggestionCard[] = [];
let cacheContextKey = '';

const buildContextKey = (ctx: SuggestionContext): string =>
  `${Math.round(ctx.remainingCalories / 100)}-${ctx.alreadyPlanned.length}-${ctx.targetMealTypes.join(',')}`;

export const generateSuggestionBatch = async (
  context: SuggestionContext
): Promise<MealSuggestionCard[]> => {
  const key = buildContextKey(context);
  if (key === cacheContextKey && cachedBatch.length > 0) {
    return cachedBatch;
  }

  if (context.remainingCalories <= 50) {
    cachedBatch = [];
    cacheContextKey = key;
    return [];
  }

  const mealTypes = context.targetMealTypes.length > 0
    ? context.targetMealTypes.join(', ')
    : 'lunch, dinner, snack';

  const prompt = `You are a meal planner AI. Generate 6 different ${mealTypes} suggestions.
All suggestions must have mealType "${mealTypes}".

REMAINING BUDGET for the day:
- ${Math.round(context.remainingCalories)} kcal remaining
- ${Math.round(context.remainingProtein)}g protein remaining
- ${Math.round(context.remainingCarbs)}g carbs remaining
- ${Math.round(context.remainingFat)}g fat remaining

ALREADY PLANNED OR REJECTED (do NOT suggest these again): ${context.alreadyPlanned.length > 0 ? context.alreadyPlanned.join(', ') : 'nothing'}

USER'S FAVORITE FOODS: ${context.favoriteNames.length > 0 ? context.favoriteNames.slice(0, 10).join(', ') : 'none yet'}

RECENTLY EATEN (past week): ${context.recentFoodNames.length > 0 ? context.recentFoodNames.slice(0, 15).join(', ') : 'none'}
${context.userFeedback.length > 0 ? `
USER FEEDBACK (important — respect these preferences):
${context.userFeedback.map(f => `- ${f}`).join('\n')}
` : ''}
Respond ONLY with valid JSON array (no markdown, no backticks):
[
  {
    "name": "Grilled Chicken Salad",
    "description": "Mixed greens with grilled chicken, cherry tomatoes, feta",
    "mealType": "lunch",
    "items": [
      { "name": "Grilled Chicken Salad", "portion": "~350g", "calories": 420, "protein": 38, "carbs": 15, "fat": 22, "fiber": 4, "sugar": 5, "confidence": 0.85 }
    ],
    "totals": { "calories": 420, "protein": 38, "carbs": 15, "fat": 22, "fiber": 4, "sugar": 5 },
    "tags": ["high-protein", "low-carb"]
  }
]

Rules:
- ALL 6 suggestions must be for ${mealTypes} specifically
- Each suggestion is ONE complete meal (not individual ingredients)
- Do NOT suggest any meal from the "ALREADY PLANNED OR REJECTED" list above
- All 6 must be DIFFERENT meals from each other
- ~30% from user's favorites/recently eaten, ~70% new ideas
- All macro values must be realistic and sum correctly
- Keep descriptions under 20 words
- Portions in grams, realistic home-cooked sizes
- Include Serbian/Balkan dishes when appropriate (ćevapi, pljeskavica, gibanica, sarma, etc.)
- Tags: pick from [high-protein, low-carb, low-fat, quick, vegetarian, high-fiber, comfort-food, light]
- Each meal should fit within the remaining budget`;

  try {
    const text = await callTextModel(prompt);
    if (!text) {
      throw new Error('All AI models returned empty response');
    }

    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error('AI returned invalid JSON: ' + cleaned.substring(0, 100));
    }

    if (!Array.isArray(parsed)) {
      throw new Error('AI returned non-array: ' + typeof parsed);
    }

    cachedBatch = parsed
      .map((s: any): MealSuggestionCard | null => {
        try {
          const items: FoodItem[] = (s.items ?? []).map((item: any) => ({
            name: String(item.name ?? 'Unknown'),
            portion: String(item.portion ?? '1 serving'),
            calories: Number(item.calories) || 0,
            protein: Number(item.protein) || 0,
            carbs: Number(item.carbs) || 0,
            fat: Number(item.fat) || 0,
            fiber: Number(item.fiber) || 0,
            sugar: Number(item.sugar) || 0,
            confidence: Number(item.confidence) || 0.8,
          }));

          const totals: NutrientInfo = s.totals
            ? {
                calories: Number(s.totals.calories) || 0,
                protein: Number(s.totals.protein) || 0,
                carbs: Number(s.totals.carbs) || 0,
                fat: Number(s.totals.fat) || 0,
                fiber: Number(s.totals.fiber) || 0,
                sugar: Number(s.totals.sugar) || 0,
              }
            : {
                calories: items.reduce((sum, i) => sum + i.calories, 0),
                protein: items.reduce((sum, i) => sum + i.protein, 0),
                carbs: items.reduce((sum, i) => sum + i.carbs, 0),
                fat: items.reduce((sum, i) => sum + i.fat, 0),
                fiber: items.reduce((sum, i) => sum + i.fiber, 0),
                sugar: items.reduce((sum, i) => sum + i.sugar, 0),
              };

          const tags = Array.isArray(s.tags)
            ? s.tags.map(String).slice(0, 3)
            : [];

          return {
            name: String(s.name ?? 'Meal'),
            description: String(s.description ?? ''),
            mealType: ['breakfast', 'lunch', 'dinner', 'snack'].includes(s.mealType)
              ? s.mealType
              : 'lunch',
            items,
            totals,
            tags,
          };
        } catch {
          return null;
        }
      })
      .filter((s: MealSuggestionCard | null): s is MealSuggestionCard => s !== null)
      .slice(0, 8);

    cacheContextKey = key;
    return cachedBatch;
  } catch (err) {
    cachedBatch = [];
    cacheContextKey = '';
    throw err;
  }
};

export const clearSuggestionCache = (): void => {
  cachedBatch = [];
  cacheContextKey = '';
};
