import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import SwipeDeck from '../components/SwipeDeck';
import MealPlanView from '../components/MealPlanView';
import { MealSuggestionCard, PlannedMeal, SuggestionContext } from '../types/mealPlan';
import { NutrientInfo, DailyGoals } from '../types/nutrition';
import {
  getOrCreatePlan,
  addMealToPlan,
  removeMealFromPlan,
  clearPlan,
  getPlanTotals,
  saveFeedback,
  getRecentFeedback,
} from '../services/mealPlanStorage';
import { generateSuggestionBatch, clearSuggestionCache } from '../services/mealPlanSuggestions';
import { getDailyTotals, getRecentMeals, getFavorites } from '../services/mealStorage';
import { loadGoals } from '../services/nutritionGoals';
import { useTheme } from '../services/theme';

type ViewMode = 'discover' | 'plan';

const MealPlannerScreen: React.FC = () => {
  const { theme } = useTheme();

  const [viewMode, setViewMode] = useState<ViewMode>('discover');
  const [planDate, setPlanDate] = useState<'today' | 'tomorrow'>('tomorrow');
  const [planId, setPlanId] = useState<string>('');
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([]);
  const [suggestions, setSuggestions] = useState<MealSuggestionCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [goals, setGoals] = useState<DailyGoals>({ calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50 });
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectedNames, setRejectedNames] = useState<string[]>([]);
  const [userFeedback, setUserFeedback] = useState<string[]>([]);
  const [rejectedCount, setRejectedCount] = useState(0);

  const MEAL_PHASES = ['breakfast', 'lunch', 'dinner'] as const;
  type MealPhase = typeof MEAL_PHASES[number];

  const getPhaseForMeals = (meals: PlannedMeal[]): MealPhase | 'done' => {
    const plannedTypes = new Set(meals.map((m) => m.mealType));
    for (const phase of MEAL_PHASES) {
      if (!plannedTypes.has(phase)) return phase;
    }
    return 'done';
  };

  const currentPhase = getPhaseForMeals(plannedMeals);

  const getTargetDate = useCallback((): string => {
    const d = new Date();
    if (planDate === 'tomorrow') d.setDate(d.getDate() + 1);
    return format(d, 'yyyy-MM-dd');
  }, [planDate]);

  const loadPlan = useCallback(async () => {
    const targetDate = getTargetDate();
    const [plan, userGoals, feedback] = await Promise.all([
      getOrCreatePlan(targetDate),
      loadGoals(),
      getRecentFeedback(15),
    ]);
    setPlanId(plan.id);
    setPlannedMeals(plan.meals);
    setGoals(userGoals);
    setUserFeedback(feedback.map((f) => `"${f.foodName}": ${f.feedback}`));
  }, [getTargetDate]);

  const buildContext = async (mealsOverride?: PlannedMeal[]): Promise<SuggestionContext> => {
    const meals = mealsOverride ?? plannedMeals;
    const planTotalsVal = getPlanTotals(meals);
    const todayTotals = planDate === 'today' ? await getDailyTotals(new Date()) : { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };

    const usedCalories = planTotalsVal.calories + todayTotals.calories;
    const usedProtein = planTotalsVal.protein + todayTotals.protein;
    const usedCarbs = planTotalsVal.carbs + todayTotals.carbs;
    const usedFat = planTotalsVal.fat + todayTotals.fat;

    const [recentMeals, favorites] = await Promise.all([
      getRecentMeals(20),
      getFavorites(10),
    ]);

    const phase = getPhaseForMeals(meals);
    const targetMealTypes = phase !== 'done' ? [phase] : [];

    return {
      remainingCalories: Math.max(0, goals.calories - usedCalories),
      remainingProtein: Math.max(0, goals.protein - usedProtein),
      remainingCarbs: Math.max(0, goals.carbs - usedCarbs),
      remainingFat: Math.max(0, goals.fat - usedFat),
      alreadyPlanned: [...meals.map((m) => m.name), ...rejectedNames],
      favoriteNames: favorites.map((f) => f.name),
      recentFoodNames: [...new Set(recentMeals.flatMap((m) => m.items.map((i) => i.name)))],
      targetMealTypes,
      userFeedback,
    };
  };

  const loadSuggestions = async (mealsOverride?: PlannedMeal[]) => {
    setLoading(true);
    setError(null);
    try {
      clearSuggestionCache();
      const context = await buildContext(mealsOverride);
      const batch = await generateSuggestionBatch(context);
      setSuggestions(batch);
      if (batch.length === 0) {
        setError('No suggestions returned. API may be rate-limited — try again in a minute.');
      }
    } catch (err: any) {
      setSuggestions([]);
      setError(err?.message ?? 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPlan().then(() => loadSuggestions());
    }, [planDate])
  );

  const handleAccept = async (suggestion: MealSuggestionCard) => {
    if (!planId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const added = await addMealToPlan(planId, suggestion);
    const newPlanned = [...plannedMeals, added];
    setPlannedMeals(newPlanned);
    setRejectedNames([]);
    setRejectedCount(0);

    const nextPhase = getPhaseForMeals(newPlanned);
    if (nextPhase !== 'done') {
      setSuggestions([]);
      // Pass newPlanned so buildContext sees the updated list immediately
      loadSuggestions(newPlanned);
    } else {
      setSuggestions([]);
      setViewMode('plan');
    }
  };

  const showFeedbackPrompt = (suggestionName: string) => {
    Alert.alert(
      'Not what you wanted?',
      'Help us suggest better meals — what was wrong?',
      [
        { text: 'Too many calories', onPress: () => { saveFeedback(suggestionName, 'Too many calories — suggest lighter meals'); } },
        { text: "Don't like this food", onPress: () => { saveFeedback(suggestionName, `User dislikes "${suggestionName}" — avoid similar foods`); } },
        { text: 'Wrong style/cuisine', onPress: () => { saveFeedback(suggestionName, 'Wrong cuisine style — try different cuisines'); } },
        {
          text: 'Other...',
          onPress: () => {
            Alert.prompt(
              'Tell us more',
              'What kind of meals would you prefer?',
              (text) => {
                if (text?.trim()) saveFeedback(suggestionName, `User preference: ${text.trim()}`);
              },
              'plain-text',
              '',
              'default'
            );
          },
        },
        { text: 'Skip', style: 'cancel' },
      ]
    );
  };

  const handleReject = (suggestion: MealSuggestionCard) => {
    setRejectedNames((prev) => [...prev, suggestion.name]);
    const newCount = rejectedCount + 1;
    setRejectedCount(newCount);
    // Ask for feedback every 3 rejections
    if (newCount % 3 === 0) {
      showFeedbackPrompt(suggestion.name);
    }
  };

  const handleRemove = async (mealId: string) => {
    await removeMealFromPlan(mealId);
    setPlannedMeals((prev) => prev.filter((m) => m.id !== mealId));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClear = async () => {
    if (!planId) return;
    await clearPlan(planId);
    setPlannedMeals([]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleRequestMore = () => {
    loadSuggestions();
  };

  const handleDateToggle = (date: 'today' | 'tomorrow') => {
    setPlanDate(date);
    clearSuggestionCache();
    setRejectedNames([]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    clearSuggestionCache();
    await loadPlan();
    await loadSuggestions();
    setRefreshing(false);
  };

  const planTotals = getPlanTotals(plannedMeals);
  const targetDateStr = planDate === 'today'
    ? format(new Date(), 'EEEE, MMM d')
    : format(new Date(Date.now() + 86400000), 'EEEE, MMM d');

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        {/* Header */}
        <Text style={[styles.title, { color: theme.text }]}>Meal Planner</Text>
        <Text style={[styles.subtitle, { color: theme.textTertiary }]}>{targetDateStr}</Text>

        {/* Date toggle */}
        <View style={styles.dateToggle}>
          <TouchableOpacity
            style={[styles.datePill, planDate === 'today' && styles.datePillActive]}
            onPress={() => handleDateToggle('today')}
          >
            <Text style={[styles.datePillText, planDate === 'today' && styles.datePillTextActive]}>
              Today
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.datePill, planDate === 'tomorrow' && styles.datePillActive]}
            onPress={() => handleDateToggle('tomorrow')}
          >
            <Text style={[styles.datePillText, planDate === 'tomorrow' && styles.datePillTextActive]}>
              Tomorrow
            </Text>
          </TouchableOpacity>
        </View>

        {/* View mode toggle */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewPill, { borderColor: theme.separator }, viewMode === 'discover' && { borderColor: theme.accent, backgroundColor: theme.accent + '15' }]}
            onPress={() => setViewMode('discover')}
          >
            <Text style={[styles.viewPillText, { color: theme.textSecondary }, viewMode === 'discover' && { color: theme.accent }]}>
              Discover
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewPill, { borderColor: theme.separator }, viewMode === 'plan' && { borderColor: theme.accent, backgroundColor: theme.accent + '15' }]}
            onPress={() => setViewMode('plan')}
          >
            <Text style={[styles.viewPillText, { color: theme.textSecondary }, viewMode === 'plan' && { color: theme.accent }]}>
              My Plan ({plannedMeals.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Phase indicator */}
        {viewMode === 'discover' && currentPhase !== 'done' && (
          <View style={styles.phaseRow}>
            {MEAL_PHASES.map((phase) => {
              const planned = plannedMeals.some((m) => m.mealType === phase);
              const active = phase === currentPhase;
              return (
                <View key={phase} style={[styles.phaseStep, active && { borderColor: theme.accent, backgroundColor: theme.accent + '15' }, planned && { borderColor: '#4ECDC4', backgroundColor: 'rgba(78,205,196,0.15)' }]}>
                  <Text style={[styles.phaseText, { color: theme.textTertiary }, active && { color: theme.accent }, planned && { color: '#4ECDC4' }]}>
                    {planned ? '✓ ' : ''}{phase.charAt(0).toUpperCase() + phase.slice(1)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Content */}
        {error && (
          <View style={[styles.errorBanner, { backgroundColor: 'rgba(255,75,75,0.1)', borderColor: 'rgba(255,75,75,0.2)' }]}>
            <Text style={{ color: '#FF6B6B', fontSize: 13, textAlign: 'center' }}>{error}</Text>
          </View>
        )}

        {viewMode === 'discover' ? (
          <SwipeDeck
            suggestions={suggestions}
            loading={loading}
            onAccept={handleAccept}
            onReject={handleReject}
            onRequestMore={handleRequestMore}
          />
        ) : (
          <MealPlanView
            meals={plannedMeals}
            totals={planTotals}
            goals={goals}
            onRemove={handleRemove}
            onClear={handleClear}
          />
        )}

        {/* Quick plan summary when in discover mode */}
        {viewMode === 'discover' && plannedMeals.length > 0 && (
          <TouchableOpacity
            style={[styles.planSummary, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
            onPress={() => setViewMode('plan')}
          >
            <Text style={[styles.planSummaryText, { color: theme.text }]}>
              📋 {plannedMeals.length} meal{plannedMeals.length !== 1 ? 's' : ''} planned — {Math.round(planTotals.calories)} kcal
            </Text>
            <Text style={[styles.planSummaryLink, { color: theme.accent }]}>View →</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 16,
  },
  dateToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  datePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  datePillActive: {
    backgroundColor: 'rgba(255,107,53,0.15)',
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  datePillText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  datePillTextActive: {
    color: '#FF6B35',
  },
  viewToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  viewPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  viewPillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  planSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginTop: 16,
  },
  planSummaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  phaseRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  phaseStep: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  phaseText: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorBanner: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  planSummaryLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});

export default MealPlannerScreen;
