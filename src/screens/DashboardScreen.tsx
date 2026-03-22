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
import { getMealsForDay, getDailyTotals, deleteMeal } from '../services/mealStorage';
import { DEFAULT_GOALS, NUTRIENT_COLORS, loadGoals } from '../services/nutritionGoals';
import { MealEntry, DailyTotals, DailyGoals } from '../types/nutrition';

const DashboardScreen: React.FC = () => {
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [totals, setTotals] = useState<DailyTotals>({
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, meals: 0,
  });
  const [goals, setGoals] = useState<DailyGoals>(DEFAULT_GOALS);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const today = new Date();
    const [dayMeals, dayTotals, userGoals] = await Promise.all([
      getMealsForDay(today),
      getDailyTotals(today),
      loadGoals(),
    ]);
    setMeals(dayMeals);
    setTotals(dayTotals);
    setGoals(userGoals);
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
        <Text style={styles.greeting}>
          {remaining > 0
            ? `${Math.round(remaining)} kcal remaining`
            : `${Math.abs(Math.round(remaining))} kcal over goal`}
        </Text>

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

        {/* Meals list */}
        <View style={styles.mealsSection}>
          <Text style={styles.sectionTitle}>Today's Meals</Text>
          {meals.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📸</Text>
              <Text style={styles.emptyText}>
                No meals logged yet today
              </Text>
              <Text style={styles.emptySubtext}>
                Tap the camera to scan your first meal
              </Text>
            </View>
          ) : (
            meals.map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                onDelete={() => handleDeleteMeal(meal)}
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
});

export default DashboardScreen;
