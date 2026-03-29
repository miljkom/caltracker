import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Animated,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import NutrientRing from '../components/NutrientRing';
import MealCard from '../components/MealCard';
import EditMealModal from '../components/EditMealModal';
import { getMealsForDay, getDailyTotals, deleteMeal, updateMeal, getLoggingStreak, logWater, getWaterForDay, undoLastWater } from '../services/mealStorage';
import { DEFAULT_GOALS, NUTRIENT_COLORS, loadGoals, loadWaterGoal, DEFAULT_WATER_GOAL } from '../services/nutritionGoals';
import { MealEntry, DailyTotals, DailyGoals, NutrientInfo, FoodItem } from '../types/nutrition';
import { getMealSuggestions, getRecipe } from '../services/mealSuggestions';

const DashboardScreen: React.FC = () => {
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [totals, setTotals] = useState<DailyTotals>({
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, meals: 0,
  });
  const [goals, setGoals] = useState<DailyGoals>(DEFAULT_GOALS);
  const [streak, setStreak] = useState(0);
  const [water, setWater] = useState(0);
  const [waterGoal, setWaterGoal] = useState(DEFAULT_WATER_GOAL);
  const [refreshing, setRefreshing] = useState(false);
  const [renderKey, setRenderKey] = useState(0);
  const [editingMeal, setEditingMeal] = useState<MealEntry | null>(null);

  const waterScale = React.useRef(new Animated.Value(1)).current;
  const bounceWater = () => {
    Animated.sequence([
      Animated.timing(waterScale, { toValue: 1.05, duration: 100, useNativeDriver: true }),
      Animated.timing(waterScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const loadData = async () => {
    const today = new Date();
    const [dayMeals, dayTotals, userGoals, currentStreak, dayWater, userWaterGoal] = await Promise.all([
      getMealsForDay(today),
      getDailyTotals(today),
      loadGoals(),
      getLoggingStreak(),
      getWaterForDay(today),
      loadWaterGoal(),
    ]);
    setMeals(dayMeals);
    setTotals(dayTotals);
    setGoals(userGoals);
    setStreak(currentStreak);
    setWater(dayWater);
    setWaterGoal(userWaterGoal);
  };

  useFocusEffect(
    useCallback(() => {
      setRenderKey(k => k + 1);
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleEditMeal = (meal: MealEntry) => {
    setEditingMeal(meal);
  };

  const handleSaveEditedMeal = async (mealId: string, items: FoodItem[], totals: NutrientInfo) => {
    await updateMeal(mealId, items, totals);
    await loadData();
  };

  const handleDeleteMeal = (meal: MealEntry) => {
    Alert.alert(
      'Delete Meal',
      `Remove this ${meal.mealType} (${Math.round(meal.totals.calories)} kcal)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await deleteMeal(meal.id);
            await loadData();
          },
        },
      ]
    );
  };

  const [aiSuggestions, setAiSuggestions] = useState<{ mealType: string; name: string; description: string; approxCalories: number }[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [recipeModal, setRecipeModal] = useState<{ name: string; text: string } | null>(null);
  const [loadingRecipe, setLoadingRecipe] = useState(false);

  const handleSuggestionTap = async (s: { name: string; approxCalories: number }) => {
    setLoadingRecipe(true);
    setRecipeModal({ name: s.name, text: '' });
    try {
      const recipe = await getRecipe(s.name, s.approxCalories);
      setRecipeModal({ name: s.name, text: recipe });
    } catch {
      setRecipeModal({ name: s.name, text: 'Could not load recipe. Try again.' });
    } finally {
      setLoadingRecipe(false);
    }
  };

  // Load AI suggestions after data loads (non-blocking)
  React.useEffect(() => {
    if (totals.meals > 0 && totals.calories < goals.calories) {
      setLoadingSuggestions(true);
      getMealSuggestions(totals, goals, meals)
        .then(setAiSuggestions)
        .finally(() => setLoadingSuggestions(false));
    } else {
      setAiSuggestions([]);
    }
  }, [totals.calories, totals.meals]);

  const remaining = goals.calories - totals.calories;
  const getRemainingText = () => {
    if (totals.calories === 0) return 'Start logging your meals!';
    if (remaining > goals.calories * 0.5) return `${Math.round(remaining)} kcal remaining`;
    if (remaining > 0) return `${Math.round(remaining)} kcal to go — almost there!`;
    if (remaining >= -100) return 'Goal reached — nice work!';
    return `${Math.abs(Math.round(remaining))} kcal over goal`;
  };
  const goalReached = totals.calories > 0 && remaining <= 0 && remaining >= -100;
  const dateStr = format(new Date(), 'EEEE, MMM d');

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B35"
          />
        }
      >
        {/* Date header */}
        <Text style={styles.date}>{dateStr}</Text>
        <Text style={[styles.greeting, goalReached && { color: '#4ECDC4' }]}>
          {getRemainingText()}
        </Text>
        {streak >= 2 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>🔥 {streak}-day streak</Text>
          </View>
        )}

        {/* Main calorie ring */}
        <View key={`rings-${renderKey}`} style={styles.mainRingContainer}>
          <NutrientRing
            current={totals.calories}
            goal={goals.calories}
            size={180}
            strokeWidth={14}
            color={NUTRIENT_COLORS.calories}
            label="kcal"
          />
        </View>

        {/* Macro rings row */}
        <View key={`macros-${renderKey}`} style={styles.macroRings}>
          <NutrientRing
            current={totals.protein}
            goal={goals.protein}
            size={90}
            strokeWidth={7}
            color={NUTRIENT_COLORS.protein}
            label="Protein"
          />
          <NutrientRing
            current={totals.carbs}
            goal={goals.carbs}
            size={90}
            strokeWidth={7}
            color={NUTRIENT_COLORS.carbs}
            label="Carbs"
          />
          <NutrientRing
            current={totals.fat}
            goal={goals.fat}
            size={90}
            strokeWidth={7}
            color={NUTRIENT_COLORS.fat}
            label="Fat"
          />
        </View>

        {/* Extra nutrients */}
        <View style={styles.extraNutrients}>
          <NutrientPill
            label="Fiber"
            current={totals.fiber}
            goal={goals.fiber}
            color={NUTRIENT_COLORS.fiber}
          />
          <NutrientPill
            label="Sugar"
            current={totals.sugar}
            goal={goals.sugar}
            color={NUTRIENT_COLORS.sugar}
          />
          <NutrientPill
            label="Meals"
            current={totals.meals}
            goal={0}
            color="rgba(255,255,255,0.4)"
            hideGoal
          />
        </View>

        {/* Macro tips */}
        {totals.meals > 0 && new Date().getHours() >= 12 && (
          <View style={styles.tipsSection}>
            {totals.protein < goals.protein * 0.5 && (
              <View style={styles.tipCard}>
                <Text style={styles.tipText}>
                  💪 Protein is low today — try chicken, eggs, or Greek yogurt
                </Text>
              </View>
            )}
            {totals.fiber < goals.fiber * 0.4 && (
              <View style={styles.tipCard}>
                <Text style={styles.tipText}>
                  🥦 Need more fiber — add veggies, beans, or whole grains
                </Text>
              </View>
            )}
            {totals.sugar > goals.sugar * 1.2 && (
              <View style={styles.tipCard}>
                <Text style={[styles.tipText, { color: '#FF6B6B' }]}>
                  🍬 Sugar is over target — watch for hidden sugars in drinks
                </Text>
              </View>
            )}
            {totals.fat > goals.fat * 1.3 && (
              <View style={styles.tipCard}>
                <Text style={[styles.tipText, { color: '#FF6B6B' }]}>
                  🧈 Fat is high today — go lighter on oils and sauces
                </Text>
              </View>
            )}
          </View>
        )}

        {/* AI Meal suggestions */}
        {totals.meals > 0 && (aiSuggestions.length > 0 || loadingSuggestions) && (
          <View style={styles.suggestionsSection}>
            <Text style={styles.sectionTitle}>What to eat next</Text>
            {loadingSuggestions && aiSuggestions.length === 0 ? (
              <View style={styles.suggestionCard}>
                <Text style={styles.suggestionText}>Thinking of meal ideas...</Text>
              </View>
            ) : (
              aiSuggestions.map((s, i) => (
                <TouchableOpacity key={i} style={styles.suggestionCard} onPress={() => handleSuggestionTap(s)} activeOpacity={0.7}>
                  <View style={styles.suggestionHeader}>
                    <Text style={styles.suggestionName}>{s.name}</Text>
                    <Text style={styles.suggestionCal}>~{s.approxCalories} kcal</Text>
                  </View>
                  <Text style={styles.suggestionDesc}>{s.description}</Text>
                  <Text style={styles.suggestionTap}>Tap for recipe</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Water tracking */}
        <Animated.View style={[styles.waterSection, { transform: [{ scale: waterScale }] }]}>
          <View style={styles.waterInfo}>
            <Text style={styles.waterIcon}>💧</Text>
            <Text style={styles.waterText}>
              {water} / {waterGoal} ml
            </Text>
          </View>
          {water > 0 && (
            <TouchableOpacity onPress={async () => { await undoLastWater(); await loadData(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Undo last water entry" accessibilityRole="button">
              <Text style={styles.waterUndo}>Undo</Text>
            </TouchableOpacity>
          )}
          <View style={styles.waterButtons}>
            <TouchableOpacity style={styles.waterBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} onPress={async () => { bounceWater(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); await logWater(250); await loadData(); }} accessibilityLabel="Add 250 milliliters of water" accessibilityRole="button">
              <Text style={styles.waterBtnText}>+250ml</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.waterBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} onPress={async () => { bounceWater(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); await logWater(500); await loadData(); }} accessibilityLabel="Add 500 milliliters of water" accessibilityRole="button">
              <Text style={styles.waterBtnText}>+500ml</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Meals list */}
        <View style={styles.mealsSection}>
          <Text style={styles.sectionTitle}>Today's Meals</Text>
          {meals.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🍽️</Text>
              <Text style={styles.emptyText}>No meals logged yet today</Text>
              <View style={styles.stepsContainer}>
                <Text style={styles.stepText}>1. Tap the <Text style={styles.stepHighlight}>Scan</Text> tab below</Text>
                <Text style={styles.stepText}>2. Take a photo of your food</Text>
                <Text style={styles.stepText}>3. Review and log your meal</Text>
              </View>
            </View>
          ) : (
            meals.map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                onDelete={() => handleDeleteMeal(meal)}
                onEdit={() => handleEditMeal(meal)}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Recipe Modal */}
      <Modal
        visible={recipeModal !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setRecipeModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{recipeModal?.name}</Text>
              <TouchableOpacity onPress={() => setRecipeModal(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {loadingRecipe ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#FF6B35" />
                <Text style={styles.modalLoadingText}>Generating recipe...</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.recipeText}>{recipeModal?.text}</Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {editingMeal && (
        <EditMealModal
          visible={!!editingMeal}
          meal={editingMeal}
          onClose={() => setEditingMeal(null)}
          onSave={handleSaveEditedMeal}
        />
      )}
    </View>
  );
};

const NutrientPill: React.FC<{
  label: string;
  current: number;
  goal: number;
  color: string;
  hideGoal?: boolean;
}> = ({ label, current, goal, color, hideGoal }) => (
  <View style={styles.nutrientPill}>
    <View style={[styles.nutrientDot, { backgroundColor: color }]} />
    <Text style={styles.nutrientPillLabel}>{label}</Text>
    <Text style={styles.nutrientPillValue}>
      {Math.round(current)}
      {!hideGoal ? `/${goal}g` : ''}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  scroll: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  date: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  greeting: {
    color: '#FAFAFA',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  streakBadge: {
    backgroundColor: 'rgba(255,107,53,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 8,
    alignSelf: 'flex-start' as const,
  },
  streakText: {
    color: '#FF6B35',
    fontSize: 13,
    fontWeight: '600',
  },
  mainRingContainer: {
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 24,
  },
  macroRings: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  waterSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(78,205,196,0.08)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(78,205,196,0.15)',
  },
  waterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  waterIcon: {
    fontSize: 20,
  },
  waterText: {
    color: '#4ECDC4',
    fontSize: 15,
    fontWeight: '700',
  },
  waterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  waterBtn: {
    backgroundColor: 'rgba(78,205,196,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  waterBtnText: {
    color: '#4ECDC4',
    fontSize: 13,
    fontWeight: '700',
  },
  waterUndo: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '600',
  },
  extraNutrients: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  nutrientPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  nutrientDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nutrientPillLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '500',
  },
  nutrientPillValue: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '700',
  },
  tipsSection: {
    gap: 8,
    marginBottom: 16,
  },
  tipCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tipText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  suggestionsSection: {
    marginBottom: 16,
  },
  suggestionCard: {
    backgroundColor: 'rgba(78,205,196,0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(78,205,196,0.12)',
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  suggestionName: {
    color: '#FAFAFA',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  suggestionCal: {
    color: '#4ECDC4',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
  suggestionDesc: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    lineHeight: 17,
  },
  suggestionTap: {
    color: '#4ECDC4',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  suggestionText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {
    color: '#FAFAFA',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  modalClose: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 16,
  },
  modalLoading: {
    padding: 60,
    alignItems: 'center',
  },
  modalLoadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 16,
  },
  modalScroll: {
    padding: 20,
  },
  recipeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 22,
  },
  mealsSection: {
    marginTop: 4,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 13,
    marginTop: 4,
  },
  stepsContainer: {
    marginTop: 16,
    gap: 8,
  },
  stepText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '500',
  },
  stepHighlight: {
    color: '#FF6B35',
    fontWeight: '700',
  },
});

export default DashboardScreen;
