import { File } from 'expo-file-system';
import { AnalysisResult, FoodItem, NutrientInfo } from '../types/nutrition';
import { cacheFoodItems, cacheFood } from './foodCache';

// ============================================================
// CONFIGURATION — API Keys (loaded from .env via app.json extra)
// ============================================================
import Constants from 'expo-constants';

const GEMINI_API_KEY = Constants.expoConfig?.extra?.geminiApiKey ?? '';
const GROQ_API_KEY = Constants.expoConfig?.extra?.groqApiKey ?? '';

// ============================================================
// MODEL POOLS
// ============================================================
// Gemini vision models — cycles to next on 429
const GEMINI_VISION_MODELS = [
  'gemini-3.1-flash-lite-preview',  // 500/day, 15 RPM
  'gemini-2.5-flash-lite',          // 20/day, 10 RPM
  'gemini-2.5-flash',               // 20/day, 5 RPM
  'gemini-3-flash-preview',         // 20/day, 5 RPM
];

// Groq vision models — 1K/day free
const GROQ_VISION_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct', // 1K/day, 30 RPM
];

// Text-only models (for item corrections) — Gemma has 14,400/day!
const TEXT_MODELS = [
  'gemma-3-27b-it',                 // 14,400/day, 30 RPM — best for text
  'gemma-3-12b-it',                 // 14,400/day, 30 RPM — fallback
  'gemini-2.5-flash-lite',          // 500/day — last resort
];
// ============================================================

import { getRecentFeedback } from './mealPlanStorage';

const BASE_ANALYSIS_PROMPT = `You are a precise nutrition analysis AI used for daily calorie tracking. Identify every food item in this photo and estimate its nutritional content.

Respond ONLY with valid JSON (no markdown, no backticks, no explanation):
{
  "items": [
    {
      "name": "Grilled Chicken Breast",
      "portion": "~150g",
      "calories": 248,
      "protein": 46,
      "carbs": 0,
      "fat": 5,
      "fiber": 0,
      "sugar": 0,
      "confidence": 0.85
    }
  ],
  "meal_type": "lunch"
}

COMPOSITE DISH RULES (CRITICAL):
- When a meal is a COMPOSITE DISH (e.g. "salad with egg, corn, yogurt" or "wrap with tuna and veggies"), list it as ONE item with the total nutrition of the whole dish combined
- Do NOT split a single dish into its raw ingredients — "Egg & Corn Salad with Greek Yogurt" is ONE item, not 4 separate items
- Only list SEPARATE items when they are truly distinct dishes on the plate (e.g. a wrap AND a side salad = 2 items)
- The item name should describe the whole dish (e.g. "Tuna Tortilla Wrap with Egg Salad", not "Tuna" + "Tortilla" + "Eggs" + "Corn" separately)
- Calculate the nutrition for the WHOLE composed dish as one entry

PORTION SIZE RULES (CRITICAL — users report overestimation):
- Use a STANDARD dinner plate (25-27cm / 10-11in) as reference for scale
- Default to SMALLER, realistic home-cooked portions, not restaurant-sized
- Meat/fish: a typical serving is 100-150g (size of a palm), NOT 200g+
- Rice/pasta/potatoes (cooked): a typical serving is 150-200g, NOT 300g+
- Bread: one slice is ~30-40g
- A tortilla/wrap: ~60-70g
- Salad/vegetables: estimate by visual volume, typically 80-150g
- When in doubt, round DOWN, not up — underestimating is safer for tracking
- Always express portions in metric (grams) as primary unit

FOOD IDENTIFICATION RULES:
- The user is from Serbia — recognize Balkan/Serbian dishes correctly
- Serbian food examples: ćevapi, pljeskavica, gibanica, burek, sarma, kajmak, ajvar, proja, pasulj, musaka, karađorđeva šnicla, prebranac, urnebes, podvarak, ražnjići, čvarci, lepinja
- Use the ENGLISH name if a common translation exists (e.g. "Bean Soup" for pasulj, "Stuffed Cabbage Rolls" for sarma)
- If no good English equivalent, keep the original Serbian name (e.g. "Ćevapi", "Kajmak", "Ajvar")
- For international foods, use standard English names
- Identify ALL distinct food items visible
- confidence: 0-1 how certain you are about identification
- meal_type: breakfast/lunch/dinner/snack (infer from food + time context)
- All nutrient values in grams except calories (kcal)
- Be accurate — users rely on this for daily health tracking`;

const getAnalysisPrompt = async (): Promise<string> => {
  try {
    const feedback = await getRecentFeedback(10);
    if (feedback.length === 0) return BASE_ANALYSIS_PROMPT;
    const feedbackLines = feedback.map((f) => `- "${f.foodName}": ${f.feedback}`).join('\n');
    return `${BASE_ANALYSIS_PROMPT}

USER CORRECTIONS (learn from these — the user previously told us):
${feedbackLines}`;
  } catch {
    return BASE_ANALYSIS_PROMPT;
  }
};

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
// Gemini API call with model cycling on 429
// ============================================================
const callGemini = async (
  contents: any[],
  maxOutputTokens: number = 4096,
  models: string[] = GEMINI_VISION_MODELS
): Promise<string> => {
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.1, maxOutputTokens },
        }),
      });
    } catch {
      throw new Error('No internet connection. Please check your network and try again.');
    }

    // Rate limited or auth error — try next model or fall back to another provider
    if ((response.status === 429 || response.status === 403) && i < models.length - 1) {
      continue;
    }

    if (response.status === 429 || response.status === 403) {
      return '@@GEMINI_EXHAUSTED@@'; // Signal to try another provider
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!text) {
      throw new Error('Empty response. Try a clearer photo.');
    }

    return text;
  }

  return '@@GEMINI_EXHAUSTED@@';
};

// ============================================================
// Groq API call with model cycling (OpenAI-compatible format)
// ============================================================
const callGroq = async (
  base64Image: string,
  prompt: string
): Promise<string> => {
  if (!GROQ_API_KEY) {
    throw new Error('All free models exhausted for today. Add a Groq API key in Settings for more capacity.');
  }

  for (let i = 0; i < GROQ_VISION_MODELS.length; i++) {
    const model = GROQ_VISION_MODELS[i];
    let response: Response;
    try {
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:image/jpeg;base64,${base64Image}` },
                },
                { type: 'text', text: prompt },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 4096,
        }),
      });
    } catch {
      throw new Error('No internet connection.');
    }

    if (response.status === 429 && i < GROQ_VISION_MODELS.length - 1) {
      continue;
    }

    if (response.status === 429) {
      throw new Error('All providers rate limited. Please try again later.');
    }

    if (!response.ok) {
      // Try next model on any error (model ID might be wrong)
      if (i < GROQ_VISION_MODELS.length - 1) continue;
      const errorBody = await response.text();
      throw new Error(`Groq API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? '';

    if (!text) {
      throw new Error('Empty response. Try a clearer photo.');
    }

    return text;
  }

  throw new Error('All providers exhausted.');
};

// ============================================================
// Groq text-only call (for item corrections when Gemini exhausted)
// ============================================================
const callGroqText = async (prompt: string): Promise<string> => {
  if (!GROQ_API_KEY) {
    throw new Error('Add a Groq API key for more capacity.');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    throw new Error('Groq text API error.');
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
};

// ============================================================
// Multi-provider vision analysis: Gemini → Groq
// ============================================================
const analyzeWithVision = async (base64Image: string): Promise<AnalysisResult> => {
  const prompt = await getAnalysisPrompt();

  // Try Gemini first (all models)
  const geminiResult = await callGemini([
    {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
        { text: prompt },
      ],
    },
  ]);

  if (geminiResult !== '@@GEMINI_EXHAUSTED@@') {
    return parseResponse(geminiResult);
  }

  // Fallback to Groq
  const groqResult = await callGroq(base64Image, prompt);
  return parseResponse(groqResult);
};

// ============================================================
// Single item re-analysis (text only, no photo)
// ============================================================
const SINGLE_ITEM_PROMPT = `You are a nutrition database. Given a food item name and portion, return its nutritional info.

Respond ONLY with valid JSON (no markdown, no backticks):
{
  "name": "the food name in English",
  "portion": "the portion in grams",
  "calories": 248,
  "protein": 46,
  "carbs": 0,
  "fat": 5,
  "fiber": 0,
  "sugar": 0,
  "confidence": 0.9
}

Rules:
- All nutrient values in grams except calories (kcal)
- Express portions in metric (grams) as primary unit
- If the food name is in Serbian or another language, translate to English (e.g. "pileći batak" → "Chicken Drumstick", "pasulj" → "Bean Soup"). Keep original name only if no good English equivalent exists (e.g. "Ćevapi", "Kajmak")
- Use realistic portion sizes — default to standard home-cooked servings, not restaurant portions
- Be accurate — this is used for daily calorie tracking`;

export const reanalyzeItem = async (
  foodName: string,
  portion: string
): Promise<FoodItem> => {
  const prompt = `${SINGLE_ITEM_PROMPT}\n\nFood: ${foodName}\nPortion: ${portion}`;

  // Try Gemini first, fall back to Groq
  let text = await callGemini(
    [{ parts: [{ text: prompt }] }],
    512,
    TEXT_MODELS
  );

  if (text === '@@GEMINI_EXHAUSTED@@') {
    text = await callGroqText(prompt);
  }

  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const item = JSON.parse(cleaned);

  const returnedItem: FoodItem = {
    name: String(item.name ?? foodName),
    portion: String(item.portion ?? portion),
    calories: Number(item.calories) || 0,
    protein: Number(item.protein) || 0,
    carbs: Number(item.carbs) || 0,
    fat: Number(item.fat) || 0,
    fiber: Number(item.fiber) || 0,
    sugar: Number(item.sugar) || 0,
    confidence: 0.95,
  };
  cacheFood(returnedItem); // Fire and forget
  return returnedItem;
};

// ============================================================
// Text-only meal analysis (no photo)
// ============================================================
export const analyzeText = async (description: string): Promise<AnalysisResult> => {
  const basePrompt = await getAnalysisPrompt();
  const prompt = `${basePrompt}\n\nThe user described their meal as: "${description}"\n\nAnalyze this text description instead of a photo. Estimate portions based on typical serving sizes.`;

  // Try Gemini first (any model works since it's text-only)
  let text = await callGemini(
    [{ parts: [{ text: prompt }] }],
    4096,
    GEMINI_VISION_MODELS
  );

  if (text === '@@GEMINI_EXHAUSTED@@') {
    text = await callGroqText(prompt);
  }

  const result = parseResponse(text);
  cacheFoodItems(result.items); // Fire and forget
  return result;
};

// ============================================================
// Public API
// ============================================================
export const analyzeFood = async (photoUri: string): Promise<AnalysisResult> => {
  const file = new File(photoUri);
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Convert to base64 in chunks to avoid call stack overflow on large images
  const CHUNK_SIZE = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);

  const result = await analyzeWithVision(base64);
  cacheFoodItems(result.items); // Fire and forget
  return result;
};
