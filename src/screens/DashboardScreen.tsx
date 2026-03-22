import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import NutrientRing from '../components/NutrientRing';
import MealCard from '../components/MealCard';
import { getMealsForDay, getDailyTotals, deleteMeal, updateMeal, getLoggingStreak, logWater, getWaterForDay } from '../services/mealStorage';
import { DEFAULT_GOALS, NUTRIENT_COLORS, loadGoals, loadWaterGoal, DEFAULT_WATER_GOAL } from '../services/nutritionGoals';
import { MealEntry, DailyTotals, DailyGoals, NutrientInfo, FoodItem } from '../types/nutrition';

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
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleEditMeal = (meal: MealEntry) => {
    if (meal.items.length <= 1) {
      Alert.alert('Edit Meal', 'This meal has only one item. You can delete the whole meal instead.');
      return;
    }

    const buttons = meal.items.map((item, idx) => ({
      text: `Remove: ${item.name} (${Math.round(item.calories)} kcal)`,
      style: 'destructive' as const,
      onPress: async () => {
        const newItems = meal.items.filter((_, i) => i !== idx);
        const newTotals: NutrientInfo = {
          calories: newItems.reduce((s, i) => s + i.calories, 0),
          protein: newItems.reduce((s, i) => s + i.protein, 0),
          carbs: newItems.reduce((s, i) => s + i.carbs, 0),
          fat: newItems.reduce((s, i) => s + i.fat, 0),
          fiber: newItems.reduce((s, i) => s + i.fiber, 0),
          sugar: newItems.reduce((s, i) => s + i.sugar, 0),
        };
        await updateMeal(meal.id, newItems, newTotals);
        await loadData();
      },
    }));

    buttons.push({ text: 'Cancel', style: 'cancel' as const, onPress: () => {} });

    Alert.alert('Edit Meal', 'Select an item to remove:', buttons);
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
            await deleteMeal(meal.id);
            await loadData();
          },
        },
      ]
    );
  };

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
        <View style={styles.mainRingContainer}>
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
        <View style={styles.macroRings}>
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

        {/* Water tracking */}
        <View style={styles.waterSection}>
          <View style={styles.waterInfo}>
            <Text style={styles.waterIcon}>💧</Text>
            <Text style={styles.waterText}>
              {water} / {waterGoal} ml
            </Text>
          </View>
          <View style={styles.waterButtons}>
            <TouchableOpacity style={styles.waterBtn} onPress={async () => { await logWater(250); await loadData(); }}>
              <Text style={styles.waterBtnText}>+250ml</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.waterBtn} onPress={async () => { await logWater(500); await loadData(); }}>
              <Text style={styles.waterBtnText}>+500ml</Text>
            </TouchableOpacity>
          </View>
        </View>

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
