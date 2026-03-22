import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { AnalysisResult, FoodItem } from '../types/nutrition';
import { NUTRIENT_COLORS, MEAL_TYPE_ICONS, MEAL_TYPE_LABELS } from '../services/nutritionGoals';

interface Props {
  photoUri: string;
  result: AnalysisResult | null;
  isAnalyzing: boolean;
  error: string | null;
  onSave: () => void;
  onRetake: () => void;
  onRemoveItem?: (index: number) => void;
  onChangeMealType?: (type: string) => void;
  onEditItem?: (index: number, newName: string, portion: string) => Promise<void>;
  onSaveAsFavorite?: () => void;
  notes?: string;
  onChangeNotes?: (notes: string) => void;
}

const AnalysisOverlay: React.FC<Props> = ({
  photoUri,
  result,
  isAnalyzing,
  error,
  onSave,
  onRetake,
  onRemoveItem,
  onChangeMealType,
  onEditItem,
  onSaveAsFavorite,
  notes,
  onChangeNotes,
}) => {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPortion, setEditPortion] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const startEdit = (idx: number, item: FoodItem) => {
    setEditingIdx(idx);
    setEditName(item.name);
    setEditPortion(item.portion);
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setEditName('');
    setEditPortion('');
  };

  const submitEdit = async () => {
    if (editingIdx === null || !onEditItem || !editName.trim()) return;
    setIsUpdating(true);
    try {
      await onEditItem(editingIdx, editName.trim(), editPortion.trim());
    } catch (err: any) {
      Alert.alert('Update Failed', err?.message ?? 'Could not update this item. Try again.');
    }
    setIsUpdating(false);
    setEditingIdx(null);
  };

  return (
  <View style={styles.container}>
    <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />

    <View style={styles.overlay}>
      {isAnalyzing && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Analyzing your meal...</Text>
          <Text style={styles.loadingSubtext}>
            Identifying foods & estimating nutrients
          </Text>
        </View>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retakeBtn} onPress={onRetake}>
            <Text style={styles.retakeBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {result && !isAnalyzing && (
        <ScrollView
          style={styles.resultScroll}
          contentContainerStyle={styles.resultContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Totals banner */}
          <View style={styles.totalsBanner}>
            <Text style={styles.totalCalories}>
              {Math.round(result.totals.calories)}
            </Text>
            <Text style={styles.totalCalLabel}>kcal total</Text>

            <View style={styles.macroRow}>
              <MacroChip label="Protein" value={result.totals.protein} color={NUTRIENT_COLORS.protein} />
              <MacroChip label="Carbs" value={result.totals.carbs} color={NUTRIENT_COLORS.carbs} />
              <MacroChip label="Fat" value={result.totals.fat} color={NUTRIENT_COLORS.fat} />
            </View>
          </View>

          {/* Meal type selector */}
          <View style={styles.mealTypeRow}>
            {Object.keys(MEAL_TYPE_LABELS).map((type) => {
              const isSelected = result.mealType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.mealTypePill,
                    isSelected && styles.mealTypePillSelected,
                  ]}
                  onPress={() => onChangeMealType?.(type)}
                >
                  <Text style={styles.mealTypePillIcon}>{MEAL_TYPE_ICONS[type]}</Text>
                  <Text
                    style={[
                      styles.mealTypePillLabel,
                      isSelected && styles.mealTypePillLabelSelected,
                    ]}
                  >
                    {MEAL_TYPE_LABELS[type]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Individual items */}
          <Text style={styles.sectionTitle}>Detected Items</Text>
          {result.items.map((item, idx) => (
            <View key={idx} style={[styles.itemRow, item.confidence < 0.6 && styles.itemRowLowConfidence]}>
              {editingIdx === idx ? (
                <View>
                  <Text style={styles.editLabel}>Food name</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="e.g. Grilled Chicken"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    autoFocus
                  />
                  <Text style={styles.editLabel}>Portion</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editPortion}
                    onChangeText={setEditPortion}
                    placeholder="e.g. 1 cup, 200g"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity style={styles.editSubmitBtn} onPress={submitEdit} disabled={isUpdating}>
                      <Text style={styles.editSubmitText}>{isUpdating ? 'Updating...' : 'Update'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editCancelBtn} onPress={cancelEdit}>
                      <Text style={styles.editCancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.itemHeader}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => onEditItem && startEdit(idx, item)}>
                      <Text style={styles.itemName}>{item.name} <Text style={styles.editHint}>✎</Text></Text>
                    </TouchableOpacity>
                    <Text style={styles.itemCal}>{Math.round(item.calories)} kcal</Text>
                    {onRemoveItem && (
                      <TouchableOpacity
                        style={styles.removeItemBtn}
                        onPress={() => onRemoveItem(idx)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.removeItemText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.itemPortion}>{item.portion}</Text>
                  <View style={styles.itemMacros}>
                    <Text style={[styles.itemMacro, { color: NUTRIENT_COLORS.protein }]}>
                      P {Math.round(item.protein)}g
                    </Text>
                    <Text style={[styles.itemMacro, { color: NUTRIENT_COLORS.carbs }]}>
                      C {Math.round(item.carbs)}g
                    </Text>
                    <Text style={[styles.itemMacro, { color: NUTRIENT_COLORS.fat }]}>
                      F {Math.round(item.fat)}g
                    </Text>
                  </View>
                  {item.confidence < 0.6 && (
                    <Text style={styles.lowConfidence}>
                      ⚠️ Low confidence — tap name to correct
                    </Text>
                  )}
                </>
              )}
            </View>
          ))}

          {result.items.some(item => item.confidence < 0.6) && (
            <View style={styles.confidenceBanner}>
              <Text style={styles.confidenceBannerText}>
                ⚠️ Some items may be inaccurate — remove anything that's wrong
              </Text>
            </View>
          )}

          {/* Notes input */}
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={onChangeNotes}
              placeholder="e.g. At restaurant, smaller portion..."
              placeholderTextColor="rgba(255,255,255,0.2)"
              multiline
              maxLength={200}
            />
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
              <Text style={styles.saveBtnText}>Log This Meal</Text>
            </TouchableOpacity>
            {onSaveAsFavorite && (
              <TouchableOpacity style={styles.favoriteBtn} onPress={onSaveAsFavorite}>
                <Text style={styles.favoriteBtnText}>⭐ Save as Favorite</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.retakeBtn} onPress={onRetake}>
              <Text style={styles.retakeBtnText}>Retake Photo</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  </View>
  );
};

const MacroChip: React.FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => (
  <View style={styles.macroChip}>
    <View style={[styles.macroChipDot, { backgroundColor: color }]} />
    <Text style={styles.macroChipText}>
      {label} {Math.round(value)}g
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  preview: {
    width: '100%',
    height: '40%',
  },
  overlay: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
  },
  // Loading
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#FAFAFA',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
  },
  loadingSubtext: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginTop: 6,
  },
  // Error
  errorBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  // Result
  resultScroll: {
    flex: 1,
  },
  resultContent: {
    padding: 20,
    paddingBottom: 120,
  },
  totalsBanner: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 20,
  },
  totalCalories: {
    fontSize: 56,
    fontWeight: '800',
    color: '#FF6B35',
    letterSpacing: -2,
  },
  totalCalLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: -4,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  macroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  macroChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  macroChipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  mealTypeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  mealTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  mealTypePillSelected: {
    backgroundColor: 'rgba(255,107,53,0.2)',
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  mealTypePillIcon: {
    fontSize: 14,
  },
  mealTypePillLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  mealTypePillLabelSelected: {
    color: '#FF6B35',
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  itemRow: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  itemCal: {
    color: '#FF6B35',
    fontSize: 15,
    fontWeight: '700',
  },
  itemPortion: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    marginTop: 2,
  },
  itemMacros: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  itemMacro: {
    fontSize: 12,
    fontWeight: '600',
  },
  itemRowLowConfidence: {
    borderColor: 'rgba(255,217,61,0.3)',
    backgroundColor: 'rgba(255,217,61,0.06)',
  },
  lowConfidence: {
    color: '#FFD93D',
    fontSize: 11,
    marginTop: 6,
    fontWeight: '500',
  },
  editHint: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
  },
  editLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 6,
  },
  editInput: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  editSubmitBtn: {
    flex: 1,
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  editSubmitText: {
    color: '#FAFAFA',
    fontSize: 13,
    fontWeight: '700',
  },
  editCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  editCancelText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  removeItemBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,75,75,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  removeItemText: {
    color: '#FF4B4B',
    fontSize: 12,
    fontWeight: '700',
  },
  confidenceBanner: {
    backgroundColor: 'rgba(255,217,61,0.1)',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,217,61,0.2)',
  },
  confidenceBannerText: {
    color: '#FFD93D',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  notesContainer: {
    marginTop: 16,
  },
  notesLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  notesInput: {
    color: '#FAFAFA',
    fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  // Actions
  actions: {
    marginTop: 24,
    gap: 10,
  },
  saveBtn: {
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FAFAFA',
    fontSize: 16,
    fontWeight: '700',
  },
  favoriteBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,217,61,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,217,61,0.2)',
  },
  favoriteBtnText: {
    color: '#FFD93D',
    fontSize: 15,
    fontWeight: '600',
  },
  retakeBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  retakeBtnText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AnalysisOverlay;
