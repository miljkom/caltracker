# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npx expo start          # Start dev server (scan QR with Expo Go)
npx expo start --android
npx expo start --ios
npx expo start --web
```

No test runner or linter is configured.

## Architecture

React Native (Expo SDK 52) calorie tracker app. Users photograph food, Gemini Vision AI analyzes it, and results are stored locally in SQLite.

**Navigation:** Bottom tab navigator (React Navigation) with three screens — Dashboard, Scan, History. Defined in `App.tsx`.

**Data flow for food scanning:**
1. `ScanScreen` captures photo via expo-camera or expo-image-picker
2. `foodAnalyzer.ts` converts photo to base64, sends to Gemini 2.5 Flash API, parses JSON response into typed `AnalysisResult`
3. `AnalysisOverlay` displays results; user confirms to save
4. `mealStorage.ts` persists to SQLite (`meals` table with JSON-serialized items/totals columns)

**Key services (`src/services/`):**
- `foodAnalyzer.ts` — Gemini API integration. API key is hardcoded (line ~9). Exports `analyzeFood(photoUri)`.
- `mealStorage.ts` — SQLite CRUD via expo-sqlite async API. Lazy-inits DB on first call. Exports `saveMeal`, `getMealsForDay`, `getDailyTotals`, `deleteMeal`, `getRecentMeals`.
- `nutritionGoals.ts` — Static config: `DEFAULT_GOALS`, `NUTRIENT_COLORS`, meal type icons/labels.

**Types:** All nutrition interfaces in `src/types/nutrition.ts` — `NutrientInfo`, `FoodItem`, `MealEntry`, `DailyTotals`, `AnalysisResult`.

**Theme:** Dark background (#0A0A0A), primary accent #FF6B35. Colors defined in `NUTRIENT_COLORS` map in `nutritionGoals.ts`.

## Configuration

- Gemini API key: `src/services/foodAnalyzer.ts` line 9 (`GEMINI_API_KEY`)
- Daily nutrition goals: `src/services/nutritionGoals.ts` (`DEFAULT_GOALS`)
- Expo/app config: `app.json`
- EAS Build config: `eas.json`
