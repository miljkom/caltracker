import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { MealEntry } from '../types/nutrition';
import { MEAL_TYPE_ICONS, MEAL_TYPE_LABELS, NUTRIENT_COLORS } from '../services/nutritionGoals';
import { useTheme } from '../services/theme';
import { format } from 'date-fns';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface Props {
  visible: boolean;
  meal: MealEntry;
  onClose: () => void;
}

const MacroPieChart: React.FC<{ protein: number; carbs: number; fat: number; size?: number }> = ({
  protein,
  carbs,
  fat,
  size = 120,
}) => {
  const { theme } = useTheme();
  const total = protein + carbs + fat;
  if (total === 0) return null;

  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  const proteinPct = protein / total;
  const carbsPct = carbs / total;
  const fatPct = fat / total;

  const proteinDash = circumference * proteinPct;
  const carbsDash = circumference * carbsPct;
  const fatDash = circumference * fatPct;

  const proteinOffset = 0;
  const carbsOffset = -(proteinDash);
  const fatOffset = -(proteinDash + carbsDash);

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${cx}, ${cy}`}>
          {/* Protein */}
          <Circle
            cx={cx} cy={cy} r={radius}
            stroke={NUTRIENT_COLORS.protein}
            strokeWidth={14}
            fill="none"
            strokeDasharray={`${proteinDash} ${circumference - proteinDash}`}
            strokeDashoffset={proteinOffset}
          />
          {/* Carbs */}
          <Circle
            cx={cx} cy={cy} r={radius}
            stroke={NUTRIENT_COLORS.carbs}
            strokeWidth={14}
            fill="none"
            strokeDasharray={`${carbsDash} ${circumference - carbsDash}`}
            strokeDashoffset={carbsOffset}
          />
          {/* Fat */}
          <Circle
            cx={cx} cy={cy} r={radius}
            stroke={NUTRIENT_COLORS.fat}
            strokeWidth={14}
            fill="none"
            strokeDasharray={`${fatDash} ${circumference - fatDash}`}
            strokeDashoffset={fatOffset}
          />
        </G>
      </Svg>
      <View style={styles.pieCenter}>
        <Text style={[styles.pieCenterValue, { color: theme.text }]}>{Math.round(protein + carbs + fat)}g</Text>
        <Text style={[styles.pieCenterLabel, { color: theme.textTertiary }]}>macros</Text>
      </View>
    </View>
  );
};

const MealDetailModal: React.FC<Props> = ({ visible, meal, onClose }) => {
  const { theme } = useTheme();
  const timeStr = format(new Date(meal.timestamp), 'h:mm a');
  const dateStr = format(new Date(meal.timestamp), 'EEEE, MMM d');
  const icon = MEAL_TYPE_ICONS[meal.mealType] ?? '🍽️';
  const label = MEAL_TYPE_LABELS[meal.mealType] ?? 'Meal';

  const totalMacroGrams = meal.totals.protein + meal.totals.carbs + meal.totals.fat;
  const proteinPct = totalMacroGrams > 0 ? Math.round((meal.totals.protein / totalMacroGrams) * 100) : 0;
  const carbsPct = totalMacroGrams > 0 ? Math.round((meal.totals.carbs / totalMacroGrams) * 100) : 0;
  const fatPct = totalMacroGrams > 0 ? Math.round((meal.totals.fat / totalMacroGrams) * 100) : 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Header with close */}
        <View style={[styles.header, { borderBottomColor: theme.separator }]}>
          <View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>{icon} {label}</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textTertiary }]}>{dateStr} at {timeStr}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.inputBg }]}>
            <Text style={[styles.closeBtnText, { color: theme.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Photo */}
          {meal.photoUri && (
            <Image
              source={{ uri: meal.photoUri }}
              style={[styles.photo, { backgroundColor: theme.pillBg }]}
              resizeMode="cover"
            />
          )}

          {/* Calorie banner */}
          <View style={styles.calorieBanner}>
            <Text style={[styles.calorieValue, { color: theme.accent }]}>{Math.round(meal.totals.calories)}</Text>
            <Text style={[styles.calorieLabel, { color: theme.textTertiary }]}>kcal</Text>
          </View>

          {/* Pie chart + macro legend */}
          <View style={styles.chartSection}>
            <MacroPieChart
              protein={meal.totals.protein}
              carbs={meal.totals.carbs}
              fat={meal.totals.fat}
            />
            <View style={styles.legendColumn}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: NUTRIENT_COLORS.protein }]} />
                <View>
                  <Text style={[styles.legendValue, { color: theme.text }]}>{Math.round(meal.totals.protein)}g</Text>
                  <Text style={[styles.legendLabel, { color: theme.textTertiary }]}>Protein ({proteinPct}%)</Text>
                </View>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: NUTRIENT_COLORS.carbs }]} />
                <View>
                  <Text style={[styles.legendValue, { color: theme.text }]}>{Math.round(meal.totals.carbs)}g</Text>
                  <Text style={[styles.legendLabel, { color: theme.textTertiary }]}>Carbs ({carbsPct}%)</Text>
                </View>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: NUTRIENT_COLORS.fat }]} />
                <View>
                  <Text style={[styles.legendValue, { color: theme.text }]}>{Math.round(meal.totals.fat)}g</Text>
                  <Text style={[styles.legendLabel, { color: theme.textTertiary }]}>Fat ({fatPct}%)</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Extra nutrients */}
          <View style={styles.extraRow}>
            <View style={[styles.extraPill, { backgroundColor: theme.pillBg }]}>
              <Text style={[styles.extraValue, { color: NUTRIENT_COLORS.fiber }]}>{Math.round(meal.totals.fiber)}g</Text>
              <Text style={[styles.extraLabel, { color: theme.textTertiary }]}>Fiber</Text>
            </View>
            <View style={[styles.extraPill, { backgroundColor: theme.pillBg }]}>
              <Text style={[styles.extraValue, { color: NUTRIENT_COLORS.sugar }]}>{Math.round(meal.totals.sugar)}g</Text>
              <Text style={[styles.extraLabel, { color: theme.textTertiary }]}>Sugar</Text>
            </View>
          </View>

          {/* Items list */}
          <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>Items ({meal.items.length})</Text>
          {meal.items.map((item, idx) => (
            <View key={idx} style={[styles.itemRow, { borderBottomColor: theme.separator }]}>
              <View style={styles.itemLeft}>
                <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.itemPortion, { color: theme.textTertiary }]}>{item.portion}</Text>
              </View>
              <View style={styles.itemRight}>
                <Text style={[styles.itemCal, { color: theme.accent }]}>{Math.round(item.calories)} kcal</Text>
                <Text style={[styles.itemMacros, { color: theme.textTertiary }]}>
                  P {Math.round(item.protein)}g · C {Math.round(item.carbs)}g · F {Math.round(item.fat)}g
                </Text>
              </View>
            </View>
          ))}

          {meal.notes && (
            <View style={[styles.notesBox, { backgroundColor: theme.card }]}>
              <Text style={[styles.notesLabel, { color: theme.textTertiary }]}>Notes</Text>
              <Text style={[styles.notesText, { color: theme.textSecondary }]}>{meal.notes}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    color: '#FAFAFA',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  photo: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.6,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  calorieBanner: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  calorieValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FF6B35',
    letterSpacing: -2,
  },
  calorieLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: -4,
  },
  chartSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  pieCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  pieCenterValue: {
    color: '#FAFAFA',
    fontSize: 16,
    fontWeight: '700',
  },
  pieCenterLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  legendColumn: {
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendValue: {
    color: '#FAFAFA',
    fontSize: 16,
    fontWeight: '700',
  },
  legendLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '500',
  },
  extraRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  extraPill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  extraValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  extraLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  itemLeft: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '600',
  },
  itemPortion: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    marginTop: 2,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemCal: {
    color: '#FF6B35',
    fontSize: 15,
    fontWeight: '700',
  },
  itemMacros: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    marginTop: 2,
  },
  notesBox: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
  },
  notesLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  notesText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
});

export default MealDetailModal;
