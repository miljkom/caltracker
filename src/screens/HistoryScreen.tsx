import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { format, isToday, isYesterday } from 'date-fns';
import MealCard from '../components/MealCard';
import { getRecentMeals, deleteMeal } from '../services/mealStorage';
import { MealEntry } from '../types/nutrition';

const HistoryScreen: React.FC = () => {
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const recent = await getRecentMeals(50);
    setMeals(recent);
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

  // Group meals by day
  const grouped = groupByDay(meals);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B35" />
        }
      >
        <Text style={styles.title}>History</Text>

        {meals.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No meals logged yet</Text>
            <Text style={styles.emptySubtext}>
              Start scanning food to build your history
            </Text>
          </View>
        ) : (
          grouped.map(({ label, dayMeals, totalCals }) => (
            <View key={label} style={styles.dayGroup}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{label}</Text>
                <Text style={styles.dayCals}>
                  {Math.round(totalCals)} kcal
                </Text>
              </View>
              {dayMeals.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  onDelete={() => handleDelete(meal)}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
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
