import { File } from 'expo-file-system';
import { AnalysisResult, FoodItem, NutrientInfo } from '../types/nutrition';

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
  // Try Gemini first (all models)
  const geminiResult = await callGemini([
    {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
        { text: ANALYSIS_PROMPT },
      ],
    },
  ]);

  if (geminiResult !== '@@GEMINI_EXHAUSTED@@') {
    return parseResponse(geminiResult);
  }

  // Fallback to Groq
  const groqResult = await callGroq(base64Image, ANALYSIS_PROMPT);
  return parseResponse(groqResult);
};

// ============================================================
// Single item re-analysis (text only, no photo)
// ============================================================
const SINGLE_ITEM_PROMPT = `You are a nutrition database. Given a food item name and portion, return its nutritional info.

Respond ONLY with valid JSON (no markdown, no backticks):
{
  "name": "the food name",
  "portion": "the portion",
  "calories": 280,
  "protein": 53,
  "carbs": 0,
  "fat": 6,
  "fiber": 0,
  "sugar": 0,
  "confidence": 0.9
}

All nutrient values in grams except calories (kcal). Be accurate.`;

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

  return {
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

  return analyzeWithVision(base64);
};
