import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MealSuggestionCard } from '../types/mealPlan';
import { MEAL_TYPE_ICONS, MEAL_TYPE_LABELS, NUTRIENT_COLORS } from '../services/nutritionGoals';
import { useTheme } from '../services/theme';

interface Props {
  suggestion: MealSuggestionCard;
}

const TAG_COLORS: Record<string, string> = {
  'high-protein': '#4ECDC4',
  'low-carb': '#FFD93D',
  'low-fat': '#FF6B6B',
  'quick': '#95D5B2',
  'vegetarian': '#95D5B2',
  'high-fiber': '#95D5B2',
  'comfort-food': '#DDA0DD',
  'light': '#87CEEB',
};

const SuggestionCardContent: React.FC<Props> = ({ suggestion }) => {
  const { theme } = useTheme();
  const icon = MEAL_TYPE_ICONS[suggestion.mealType] ?? '🍽️';
  const label = MEAL_TYPE_LABELS[suggestion.mealType] ?? 'Meal';

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      {/* Meal type badge */}
      <View style={styles.badge}>
        <Text style={styles.badgeIcon}>{icon}</Text>
        <Text style={[styles.badgeText, { color: theme.textSecondary }]}>{label}</Text>
      </View>

      {/* Meal name */}
      <Text style={[styles.name, { color: theme.text }]}>{suggestion.name}</Text>

      {/* Description */}
      <Text style={[styles.description, { color: theme.textTertiary }]}>
        {suggestion.description}
      </Text>

      {/* Calorie display */}
      <Text style={styles.calories}>{Math.round(suggestion.totals.calories)}</Text>
      <Text style={[styles.calorieLabel, { color: theme.textTertiary }]}>kcal</Text>

      {/* Macro pills */}
      <View style={styles.macroRow}>
        <View style={[styles.macroPill, { borderColor: NUTRIENT_COLORS.protein + '40' }]}>
          <Text style={[styles.macroLabel, { color: NUTRIENT_COLORS.protein }]}>P</Text>
          <Text style={[styles.macroValue, { color: theme.text }]}>{Math.round(suggestion.totals.protein)}g</Text>
        </View>
        <View style={[styles.macroPill, { borderColor: NUTRIENT_COLORS.carbs + '40' }]}>
          <Text style={[styles.macroLabel, { color: NUTRIENT_COLORS.carbs }]}>C</Text>
          <Text style={[styles.macroValue, { color: theme.text }]}>{Math.round(suggestion.totals.carbs)}g</Text>
        </View>
        <View style={[styles.macroPill, { borderColor: NUTRIENT_COLORS.fat + '40' }]}>
          <Text style={[styles.macroLabel, { color: NUTRIENT_COLORS.fat }]}>F</Text>
          <Text style={[styles.macroValue, { color: theme.text }]}>{Math.round(suggestion.totals.fat)}g</Text>
        </View>
      </View>

      {/* Tags */}
      {suggestion.tags.length > 0 && (
        <View style={styles.tagRow}>
          {suggestion.tags.map((tag) => (
            <View
              key={tag}
              style={[styles.tag, { backgroundColor: (TAG_COLORS[tag] ?? '#888') + '20' }]}
            >
              <Text style={[styles.tagText, { color: TAG_COLORS[tag] ?? '#888' }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Swipe hint */}
      <View style={styles.hintRow}>
        <Text style={[styles.hintText, { color: '#FF4B4B' }]}>← SKIP</Text>
        <Text style={[styles.hintText, { color: '#4ECDC4' }]}>PLAN IT →</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 340,
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  badgeIcon: {
    fontSize: 16,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  calories: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FF6B35',
    letterSpacing: -2,
  },
  calorieLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: -4,
    marginBottom: 16,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  macroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  macroLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  macroValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  hintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
    paddingHorizontal: 10,
  },
  hintText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    opacity: 0.5,
  },
});

export default SuggestionCardContent;
