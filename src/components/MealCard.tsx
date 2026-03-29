import React, { useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Share,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { MealEntry } from '../types/nutrition';
import { MEAL_TYPE_ICONS, MEAL_TYPE_LABELS } from '../services/nutritionGoals';
import { useTheme } from '../services/theme';
import { format } from 'date-fns';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

interface Props {
  meal: MealEntry;
  onPress?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}

const MealCard: React.FC<Props> = ({ meal, onPress, onDelete, onEdit }) => {
  const { theme } = useTheme();
  const timeStr = format(new Date(meal.timestamp), 'h:mm a');
  const icon = MEAL_TYPE_ICONS[meal.mealType] ?? '🍽️';
  const label = MEAL_TYPE_LABELS[meal.mealType] ?? 'Meal';

  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD && onDelete) {
          // Swiped left → delete
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onDelete();
            translateX.setValue(0);
          });
        } else if (gestureState.dx > SWIPE_THRESHOLD && onEdit) {
          // Swiped right → edit
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
          onEdit();
        } else {
          // Snap back
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  const handleShare = async () => {
    const itemsList = meal.items.map(i => `• ${i.name} (${Math.round(i.calories)} kcal)`).join('\n');
    const message = `${icon} ${label} — ${timeStr}\n\n${itemsList}\n\nTotal: ${Math.round(meal.totals.calories)} kcal | P: ${Math.round(meal.totals.protein)}g | C: ${Math.round(meal.totals.carbs)}g | F: ${Math.round(meal.totals.fat)}g\n\nTracked with Calorie Tracker`;
    try {
      await Share.share({ message });
    } catch {}
  };

  // Background action indicators
  const editOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const deleteOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.swipeContainer}>
      {/* Background actions revealed on swipe */}
      <View style={styles.actionsBackground}>
        <Animated.View style={[styles.editAction, { opacity: editOpacity }]}>
          <Text style={[styles.actionIcon, { color: theme.textSecondary }]}>✎</Text>
          <Text style={styles.editActionText}>Edit</Text>
        </Animated.View>
        <Animated.View style={[styles.deleteAction, { opacity: deleteOpacity }]}>
          <Text style={[styles.actionIcon, { color: theme.textSecondary }]}>✕</Text>
          <Text style={styles.deleteActionText}>Delete</Text>
        </Animated.View>
      </View>

      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
          onPress={onPress}
          activeOpacity={0.7}
        >
          {meal.photoUri && (
            <Image source={{ uri: meal.photoUri }} style={[styles.photo, { backgroundColor: theme.pillBg }]} resizeMode="cover" />
          )}

          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={[styles.mealType, { color: theme.text }]}>
                {icon} {label}
              </Text>
              <Text style={[styles.time, { color: theme.textTertiary }]}>{timeStr}</Text>
            </View>

            <Text style={[styles.items, { color: theme.textSecondary }]} numberOfLines={2}>
              {meal.items.map((i) => i.name).join(', ')}
            </Text>

            {meal.notes && (
              <Text style={[styles.mealNotes, { color: theme.textTertiary }]}>{meal.notes}</Text>
            )}

            <View style={styles.macros}>
              <MacroPill label="Cal" value={meal.totals.calories} color="#FF6B35" />
              <MacroPill label="P" value={meal.totals.protein} color="#4ECDC4" unit="g" />
              <MacroPill label="C" value={meal.totals.carbs} color="#FFD93D" unit="g" />
              <MacroPill label="F" value={meal.totals.fat} color="#FF6B6B" unit="g" />
            </View>
          </View>

          <View style={styles.cardActions}>
            {onEdit && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.overlay }]} onPress={onEdit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Edit meal" accessibilityRole="button">
                <Text style={[styles.actionBtnText, { color: theme.textSecondary }]}>✎</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.overlay }]} onPress={handleShare} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Share meal" accessibilityRole="button">
              <Text style={[styles.actionBtnText, { color: theme.textSecondary }]}>↗</Text>
            </TouchableOpacity>
            {onDelete && (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.overlay }]} onPress={onDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Delete meal" accessibilityRole="button">
                <Text style={[styles.actionBtnText, { color: theme.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const MacroPill: React.FC<{
  label: string;
  value: number;
  color: string;
  unit?: string;
}> = ({ label, value, color, unit = '' }) => {
  const { theme } = useTheme();
  return (
    <View style={[styles.pill, { borderColor: color + '30' }]}>
      <Text style={[styles.pillLabel, { color: color }]}>{label}</Text>
      <Text style={[styles.pillValue, { color: theme.textSecondary }]}>
        {Math.round(value)}
        {unit}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  swipeContainer: {
    marginBottom: 12,
    overflow: 'hidden',
    borderRadius: 16,
  },
  actionsBackground: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 16,
  },
  editAction: {
    width: 80,
    height: '100%',
    backgroundColor: 'rgba(78,205,196,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  deleteAction: {
    width: 80,
    height: '100%',
    backgroundColor: 'rgba(255,75,75,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  actionIcon: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  editActionText: {
    color: '#4ECDC4',
    fontSize: 11,
    fontWeight: '700',
  },
  deleteActionText: {
    color: '#FF4B4B',
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
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
  cardActions: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default MealCard;
