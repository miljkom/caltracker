# 🍽️ Calorie Tracker

AI-powered calorie tracker that lets you snap a photo of your food and get instant nutritional estimates. Built with React Native (Expo), powered by Google Gemini Vision (free tier — no cost, no credit card).

## How It Works

1. **Snap** a photo of your meal
2. **AI analyzes** the image — identifies every food item, estimates portion sizes
3. **Get instant** calorie count + full macro breakdown (protein, carbs, fat, fiber, sugar)
4. **Track** your daily totals against your goals

## Screenshots

The app has three main screens:
- **Dashboard** — daily progress rings for calories & macros, today's meals list
- **Scan** — camera with viewfinder, capture or pick from gallery, AI analysis overlay
- **History** — all past meals grouped by day

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | React Native (Expo SDK 52) |
| Navigation | React Navigation (Bottom Tabs) |
| Food Recognition | Google Gemini 2.5 Flash (FREE — 250 req/day) |
| Local Storage | expo-sqlite |
| Camera | expo-camera + expo-image-picker |

## Quick Start

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- A FREE Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) (no credit card needed)
- Expo Go app on your phone (iOS/Android)

### Setup

```bash
# 1. Clone / copy the project
cd calorie-tracker

# 2. Install dependencies
npm install

# 3. Add your FREE Gemini API key
#    Open src/services/foodAnalyzer.ts and set:
#    - GEMINI_API_KEY: 'your-key-from-aistudio.google.com'

# 4. Start the dev server
npx expo start

# 5. Scan the QR code with Expo Go on your phone
```

### ⚠️ Important: API Key Security

The current setup embeds the API key in the client for simplicity. **For production**, you should:

1. Create a simple backend (e.g., Express, FastAPI, or a serverless function)
2. Move the Gemini API call server-side
3. Have your app call YOUR backend instead of Gemini directly

This prevents API key exposure. A minimal proxy example:

```javascript
// server.js (Node/Express example)
app.post('/analyze', async (req, res) => {
  const { image } = req.body;
  const result = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ... }) }
  );
  res.json(await result.json());
});
```

## Project Structure

```
calorie-tracker/
├── App.tsx                          # Root — tab navigation
├── src/
│   ├── types/
│   │   └── nutrition.ts             # TypeScript interfaces
│   ├── services/
│   │   ├── foodAnalyzer.ts          # AI vision API (Claude / GPT-4o)
│   │   ├── mealStorage.ts           # SQLite CRUD operations
│   │   └── nutritionGoals.ts        # Daily goals & config
│   ├── screens/
│   │   ├── DashboardScreen.tsx      # Daily overview + progress rings
│   │   ├── ScanScreen.tsx           # Camera + AI analysis flow
│   │   └── HistoryScreen.tsx        # Past meals grouped by day
│   └── components/
│       ├── NutrientRing.tsx         # Circular SVG progress ring
│       ├── MealCard.tsx             # Meal summary card
│       └── AnalysisOverlay.tsx      # Post-scan result view
├── package.json
├── app.json
└── tsconfig.json
```

## Customization

### Daily Goals

Edit `src/services/nutritionGoals.ts`:

```typescript
export const DEFAULT_GOALS = {
  calories: 2000,   // change to your target
  protein: 150,
  carbs: 250,
  fat: 65,
  fiber: 30,
  sugar: 50,
};
```

### AI Provider

In `src/services/foodAnalyzer.ts`, set your free Gemini key:

```typescript
const GEMINI_API_KEY = 'your-key-from-aistudio.google.com';
const GEMINI_MODEL = 'gemini-2.5-flash'; // best free option
```

Get your key at https://aistudio.google.com/apikey (takes 30 seconds, no credit card).

### Colors & Theme

All colors are defined in `nutritionGoals.ts` under `NUTRIENT_COLORS`. The app uses a dark theme (#0A0A0A background) with #FF6B35 as the primary accent.

## Cost

**$0. Free.**

Using Gemini 2.5 Flash free tier:
- 250 requests per day (no credit card needed)
- Even scanning 15 meals/day uses under 10% of your quota
- No token charges, no hidden fees

If you ever outgrow the free tier (unlikely for personal use), Gemini Flash paid pricing is ~$0.001 per scan.

## Extending the App

Ideas for next steps:
- **Barcode scanning** — add `expo-barcode-scanner` and look up products via Open Food Facts API
- **USDA cross-reference** — verify AI estimates against USDA FoodData Central
- **Goal settings screen** — let users set custom calorie/macro targets
- **Weekly/monthly charts** — add `react-native-chart-kit` or `victory-native` for trends
- **Export data** — CSV export of meal history
- **Backend sync** — Supabase or Firebase for multi-device sync
- **Widgets** — iOS/Android home screen widgets showing daily progress

## License

MIT — use it however you want.
