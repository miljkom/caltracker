import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { PlannedMeal } from '../types/mealPlan';
import { NutrientInfo } from '../types/nutrition';
import { MEAL_TYPE_ICONS, MEAL_TYPE_LABELS, NUTRIENT_COLORS } from '../services/nutritionGoals';
import { useTheme } from '../services/theme';

interface Props {
  meals: PlannedMeal[];
  totals: NutrientInfo;
  goals: NutrientInfo;
  onRemove: (mealId: string) => void;
  onClear: () => void;
}

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

const MealPlanView: React.FC<Props> = ({ meals, totals, goals, onRemove, onClear }) => {
  const { theme } = useTheme();

  if (meals.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          No meals planned yet
        </Text>
        <Text style={[styles.emptySubtext, { color: theme.textTertiary }]}>
          Swipe right on suggestions above to build your plan
        </Text>
      </View>
    );
  }

  // Group by meal type
  const grouped = MEAL_ORDER
    .map((type) => ({
      type,
      icon: MEAL_TYPE_ICONS[type] ?? '🍽️',
      label: MEAL_TYPE_LABELS[type] ?? 'Meal',
      items: meals.filter((m) => m.mealType === type),
    }))
    .filter((g) => g.items.length > 0);

  const caloriePercent = goals.calories > 0
    ? Math.min(Math.round((totals.calories / goals.calories) * 100), 100)
    : 0;

  return (
    <View>
      {/* Plan totals bar */}
      <View style={[styles.totalsBar, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={styles.totalsLeft}>
          <Text style={[styles.totalsCalories, { color: theme.accent }]}>
            {Math.round(totals.calories)}
          </Text>
          <Text style={[styles.totalsLabel, { color: theme.textTertiary }]}>
            / {Math.round(goals.calories)} kcal planned
          </Text>
        </View>
        <View style={styles.totalsRight}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${caloriePercent}%` }]} />
          </View>
          <View style={styles.macroMini}>
            <Text style={[styles.macroMiniText, { color: NUTRIENT_COLORS.protein }]}>
              P {Math.round(totals.protein)}g
            </Text>
            <Text style={[styles.macroMiniText, { color: NUTRIENT_COLORS.carbs }]}>
              C {Math.round(totals.carbs)}g
            </Text>
            <Text style={[styles.macroMiniText, { color: NUTRIENT_COLORS.fat }]}>
              F {Math.round(totals.fat)}g
            </Text>
          </View>
        </View>
      </View>

      {/* Grouped meals */}
      {grouped.map((group) => (
        <View key={group.type} style={styles.groupSection}>
          <Text style={[styles.groupTitle, { color: theme.textTertiary }]}>
            {group.icon} {group.label}
          </Text>
          {group.items.map((meal) => (
            <View key={meal.id} style={[styles.mealRow, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <View style={styles.mealInfo}>
                <Text style={[styles.mealName, { color: theme.text }]}>{meal.name}</Text>
                <Text style={[styles.mealMacros, { color: theme.textTertiary }]}>
                  {Math.round(meal.totals.calories)} kcal · P {Math.round(meal.totals.protein)}g · C {Math.round(meal.totals.carbs)}g · F {Math.round(meal.totals.fat)}g
                </Text>
              </View>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => onRemove(meal.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ))}

      {/* Clear plan */}
      <TouchableOpacity
        style={styles.clearBtn}
        onPress={() => {
          Alert.alert('Clear Plan', 'Remove all planned meals?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: onClear },
          ]);
        }}
      >
        <Text style={styles.clearBtnText}>Clear Plan</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  emptyContainer: {
    alignItems: 'center',
    padding: 30,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
  },
  totalsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  totalsLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  totalsCalories: {
    fontSize: 24,
    fontWeight: '800',
  },
  totalsLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  totalsRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  progressBg: {
    width: 80,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,107,53,0.15)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FF6B35',
  },
  macroMini: {
    flexDirection: 'row',
    gap: 8,
  },
  macroMiniText: {
    fontSize: 10,
    fontWeight: '700',
  },
  groupSection: {
    marginBottom: 12,
  },
  groupTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  mealMacros: {
    fontSize: 11,
    fontWeight: '500',
  },
  removeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,75,75,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  removeBtnText: {
    color: '#FF4B4B',
    fontSize: 12,
    fontWeight: '700',
  },
  clearBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  clearBtnText: {
    color: 'rgba(255,75,75,0.6)',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default MealPlanView;
