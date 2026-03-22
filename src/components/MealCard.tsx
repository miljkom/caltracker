import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { MealEntry } from '../types/nutrition';
import { MEAL_TYPE_ICONS, MEAL_TYPE_LABELS } from '../services/nutritionGoals';
import { format } from 'date-fns';

interface Props {
  meal: MealEntry;
  onPress?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}

const MealCard: React.FC<Props> = ({ meal, onPress, onDelete, onEdit }) => {
  const timeStr = format(new Date(meal.timestamp), 'h:mm a');
  const icon = MEAL_TYPE_ICONS[meal.mealType] ?? '🍽️';
  const label = MEAL_TYPE_LABELS[meal.mealType] ?? 'Meal';

  const handleShare = async () => {
    const itemsList = meal.items.map(i => `• ${i.name} (${Math.round(i.calories)} kcal)`).join('\n');
    const message = `${icon} ${label} — ${timeStr}\n\n${itemsList}\n\nTotal: ${Math.round(meal.totals.calories)} kcal | P: ${Math.round(meal.totals.protein)}g | C: ${Math.round(meal.totals.carbs)}g | F: ${Math.round(meal.totals.fat)}g\n\nTracked with Calorie Tracker`;

    try {
      await Share.share({ message });
    } catch {}
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {/* Photo thumbnail */}
        {meal.photoUri && (
          <Image source={{ uri: meal.photoUri }} style={styles.photo} resizeMode="cover" />
        )}

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.mealType}>
              {icon} {label}
            </Text>
            <Text style={styles.time}>{timeStr}</Text>
          </View>

          {/* Food items */}
          <Text style={styles.items} numberOfLines={2}>
            {meal.items.map((i) => i.name).join(', ')}
          </Text>

          {meal.notes && (
            <Text style={styles.mealNotes}>{meal.notes}</Text>
          )}

          {/* Macros row */}
          <View style={styles.macros}>
            <MacroPill label="Cal" value={meal.totals.calories} color="#FF6B35" />
            <MacroPill label="P" value={meal.totals.protein} color="#4ECDC4" unit="g" />
            <MacroPill label="C" value={meal.totals.carbs} color="#FFD93D" unit="g" />
            <MacroPill label="F" value={meal.totals.fat} color="#FF6B6B" unit="g" />
          </View>
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Share meal" accessibilityRole="button">
          <Text style={styles.shareBtnText}>↗</Text>
        </TouchableOpacity>

        {onEdit && (
          <TouchableOpacity style={styles.editBtn} onPress={onEdit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Edit meal" accessibilityRole="button">
            <Text style={styles.editBtnText}>✎</Text>
          </TouchableOpacity>
        )}

        {onDelete && (
          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Delete meal" accessibilityRole="button">
            <Text style={styles.deleteText}>✕</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );
};

const MacroPill: React.FC<{
  label: string;
  value: number;
  color: string;
  unit?: string;
}> = ({ label, value, color, unit = '' }) => (
  <View style={[styles.pill, { borderColor: color + '30' }]}>
    <Text style={[styles.pillLabel, { color: color }]}>{label}</Text>
    <Text style={styles.pillValue}>
      {Math.round(value)}
      {unit}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  photo: {
    width: '100%',
    height: 160,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  content: {
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  mealType: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '600',
  },
  time: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '500',
  },
  items: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  mealNotes: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  macros: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  pillValue: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  shareBtn: {
    position: 'absolute',
    top: 10,
    right: 78,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtnText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '700',
  },
  editBtn: {
    position: 'absolute',
    top: 10,
    right: 44,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBtnText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  deleteBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default MealCard;
