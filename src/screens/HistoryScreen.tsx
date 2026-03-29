import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { format, isToday, isYesterday } from 'date-fns';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import MealCard from '../components/MealCard';
import EditMealModal from '../components/EditMealModal';
import MealDetailModal from '../components/MealDetailModal';
import { getRecentMeals, deleteMeal, updateMeal, getWeeklyTotals } from '../services/mealStorage';
import { loadGoals } from '../services/nutritionGoals';
import { MealEntry, NutrientInfo, FoodItem } from '../types/nutrition';
import { useTheme } from '../services/theme';

const HistoryScreen: React.FC = () => {
  const { theme } = useTheme();
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [weeklyData, setWeeklyData] = useState<{ date: string; calories: number; protein: number; carbs: number; fat: number }[]>([]);
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [editingMeal, setEditingMeal] = useState<MealEntry | null>(null);
  const [detailMeal, setDetailMeal] = useState<MealEntry | null>(null);

  const loadData = async () => {
    const [recent, weekly, goals] = await Promise.all([
      getRecentMeals(50),
      getWeeklyTotals(),
      loadGoals(),
    ]);
    setMeals(recent);
    setWeeklyData(weekly);
    setCalorieGoal(goals.calories);
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
    setEditingMeal(meal);
  };

  const handleSaveEditedMeal = async (mealId: string, items: FoodItem[], totals: NutrientInfo) => {
    await updateMeal(mealId, items, totals);
    await loadData();
  };

  const handleDelete = (meal: MealEntry) => {
    Alert.alert('Delete Meal', 'Remove this meal from your history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteMeal(meal.id);
          await loadData();
        },
      },
    ]);
  };

  const filteredMeals = search.trim()
    ? meals.filter(m =>
        m.items.some(i => i.name.toLowerCase().includes(search.toLowerCase())) ||
        m.mealType.toLowerCase().includes(search.toLowerCase()) ||
        (m.notes?.toLowerCase().includes(search.toLowerCase()))
      )
    : meals;

  // Group meals by day
  const grouped = groupByDay(filteredMeals);

  // Chart dimensions
  const chartWidth = Dimensions.get('window').width - 72;
  const barWidth = 30;
  const barSpacing = chartWidth / 7;
  const barPadding = (barSpacing - barWidth) / 2;
  const maxCal = Math.max(...weeklyData.map(d => d.calories), calorieGoal) * 1.1;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        <Text style={[styles.title, { color: theme.text }]}>History</Text>

        <TextInput
          style={[styles.searchInput, { color: theme.text, backgroundColor: theme.inputBg }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search meals..."
          placeholderTextColor={theme.textTertiary}
          clearButtonMode="while-editing"
        />

        {/* Weekly Overview */}
        {weeklyData.length > 0 && weeklyData.some(d => d.calories > 0) && (
          <View style={[styles.chartContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.chartTitle, { color: theme.textTertiary }]}>This Week</Text>
            <View style={styles.chart}>
              <Svg width={chartWidth} height={160}>
                <Line
                  x1={0}
                  y1={160 - (calorieGoal / maxCal) * 140}
                  x2={chartWidth}
                  y2={160 - (calorieGoal / maxCal) * 140}
                  stroke="rgba(255,107,53,0.3)"
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
                {weeklyData.map((day, i) => {
                  const barHeight = maxCal > 0 ? (day.calories / maxCal) * 140 : 0;
                  const isCurrentDay = i === 6;
                  return (
                    <React.Fragment key={i}>
                      <Rect
                        x={i * barSpacing + barPadding}
                        y={160 - barHeight}
                        width={barWidth}
                        height={barHeight}
                        rx={4}
                        fill={isCurrentDay ? '#FF6B35' : theme.chartBar}
                      />
                      <SvgText
                        x={i * barSpacing + barPadding + barWidth / 2}
                        y={155}
                        fontSize={9}
                        fill={isCurrentDay ? '#FF6B35' : theme.chartLabel}
                        textAnchor="middle"
                      >
                        {day.date}
                      </SvgText>
                      {day.calories > 0 && (
                        <SvgText
                          x={i * barSpacing + barPadding + barWidth / 2}
                          y={160 - barHeight - 5}
                          fontSize={9}
                          fill={theme.textSecondary}
                          textAnchor="middle"
                        >
                          {Math.round(day.calories)}
                        </SvgText>
                      )}
                    </React.Fragment>
                  );
                })}
              </Svg>
            </View>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#FF6B35' }]} />
                <Text style={[styles.legendText, { color: theme.textTertiary }]}>Today</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.chartBar, borderWidth: 1, borderColor: theme.separator }]} />
                <Text style={[styles.legendText, { color: theme.textTertiary }]}>Previous days</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={{ width: 12, height: 1, backgroundColor: 'rgba(255,107,53,0.3)' }} />
                <Text style={[styles.legendText, { color: theme.textTertiary }]}>Goal</Text>
              </View>
            </View>
          </View>
        )}

        {filteredMeals.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No meals logged yet</Text>
            <Text style={[styles.emptySubtext, { color: theme.textTertiary }]}>
              Start scanning food to build your history
            </Text>
          </View>
        ) : (
          grouped.map(({ label, dayMeals, totalCals }) => (
            <View key={label} style={styles.dayGroup}>
              <View style={styles.dayHeader}>
                <Text style={[styles.dayLabel, { color: theme.textSecondary }]}>{label}</Text>
                <Text style={styles.dayCals}>
                  {Math.round(totalCals)} kcal
                </Text>
              </View>
              {dayMeals.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onPress={() => setDetailMeal(meal)}
                  onDelete={() => handleDelete(meal)}
                  onEdit={() => handleEditMeal(meal)}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {detailMeal && (
        <MealDetailModal
          visible={!!detailMeal}
          meal={detailMeal}
          onClose={() => setDetailMeal(null)}
        />
      )}

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

interface DayGroup {
  label: string;
  dayMeals: MealEntry[];
  totalCals: number;
}

const groupByDay = (meals: MealEntry[]): DayGroup[] => {
  const map = new Map<string, MealEntry[]>();

  for (const meal of meals) {
    const d = new Date(meal.timestamp);
    const key = format(d, 'yyyy-MM-dd');
    const existing = map.get(key) ?? [];
    existing.push(meal);
    map.set(key, existing);
  }

  return Array.from(map.entries()).map(([key, dayMeals]) => {
    const date = new Date(key);
    let label: string;
    if (isToday(date)) label = 'Today';
    else if (isYesterday(date)) label = 'Yesterday';
    else label = format(date, 'EEEE, MMM d');

    const totalCals = dayMeals.reduce((sum, m) => sum + m.totals.calories, 0);
    return { label, dayMeals, totalCals };
  });
};

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
  title: {
    color: '#FAFAFA',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  searchInput: {
    color: '#FAFAFA',
    fontSize: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chartContainer: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chartTitle: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  chart: {
    alignItems: 'center',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontWeight: '500',
  },
  dayGroup: {
    marginBottom: 24,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '700',
  },
  dayCals: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
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

export default HistoryScreen;
