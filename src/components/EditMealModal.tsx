import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MealEntry, FoodItem, NutrientInfo } from '../types/nutrition';
import { NUTRIENT_COLORS, MEAL_TYPE_ICONS, MEAL_TYPE_LABELS } from '../services/nutritionGoals';
import { reanalyzeItem } from '../services/foodAnalyzer';
import { useTheme } from '../services/theme';

interface Props {
  visible: boolean;
  meal: MealEntry;
  onClose: () => void;
  onSave: (mealId: string, items: FoodItem[], totals: NutrientInfo) => Promise<void>;
}

const recalcTotals = (items: FoodItem[]): NutrientInfo => ({
  calories: items.reduce((s, i) => s + i.calories, 0),
  protein: items.reduce((s, i) => s + i.protein, 0),
  carbs: items.reduce((s, i) => s + i.carbs, 0),
  fat: items.reduce((s, i) => s + i.fat, 0),
  fiber: items.reduce((s, i) => s + i.fiber, 0),
  sugar: items.reduce((s, i) => s + i.sugar, 0),
});

const EditMealModal: React.FC<Props> = ({ visible, meal, onClose, onSave }) => {
  const { theme } = useTheme();
  const [items, setItems] = useState<FoodItem[]>(meal.items);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPortion, setEditPortion] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPortion, setAddPortion] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when meal changes
  React.useEffect(() => {
    setItems(meal.items);
    setEditingIdx(null);
    setAddMode(false);
  }, [meal.id]);

  const startEdit = (idx: number, item: FoodItem) => {
    setEditingIdx(idx);
    setEditName(item.name);
    setEditPortion(item.portion);
    setAddMode(false);
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setEditName('');
    setEditPortion('');
  };

  const submitEdit = async () => {
    if (editingIdx === null || !editName.trim()) return;
    setIsUpdating(true);
    try {
      const updatedItem = await reanalyzeItem(editName.trim(), editPortion.trim());
      const newItems = items.map((item, i) => (i === editingIdx ? updatedItem : item));
      setItems(newItems);
      setEditingIdx(null);
      setEditName('');
      setEditPortion('');
    } catch (err: any) {
      Alert.alert('Update Failed', err?.message ?? 'Could not update this item.');
    } finally {
      setIsUpdating(false);
    }
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    if (newItems.length === 0) {
      Alert.alert('Cannot Remove', 'A meal must have at least one item.');
      return;
    }
    setItems(newItems);
  };

  const startAdd = () => {
    setAddMode(true);
    setAddName('');
    setAddPortion('');
    setEditingIdx(null);
  };

  const cancelAdd = () => {
    setAddMode(false);
    setAddName('');
    setAddPortion('');
  };

  const submitAdd = async () => {
    if (!addName.trim()) return;
    setIsAdding(true);
    try {
      const newItem = await reanalyzeItem(addName.trim(), addPortion.trim() || '1 serving');
      setItems([...items, newItem]);
      setAddMode(false);
      setAddName('');
      setAddPortion('');
    } catch (err: any) {
      Alert.alert('Add Failed', err?.message ?? 'Could not analyze this food item.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const totals = recalcTotals(items);
      await onSave(meal.id, items, totals);
      onClose();
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message ?? 'Could not save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    items.length !== meal.items.length ||
    items.some((item, i) => item !== meal.items[i]);

  const totals = recalcTotals(items);
  const icon = MEAL_TYPE_ICONS[meal.mealType] ?? '🍽️';
  const label = MEAL_TYPE_LABELS[meal.mealType] ?? 'Meal';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.separator }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{icon} Edit {label}</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.headerBtn, styles.saveHeaderBtn]}
            disabled={isSaving || !hasChanges}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <Text style={[styles.saveText, { color: theme.accent }, !hasChanges && styles.saveTextDisabled]}>
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Totals */}
        <View style={[styles.totalsBar, { borderBottomColor: theme.separator }]}>
          <Text style={[styles.totalsCalories, { color: theme.accent }]}>{Math.round(totals.calories)}</Text>
          <Text style={[styles.totalsLabel, { color: theme.textTertiary }]}>kcal</Text>
          <View style={styles.totalsRow}>
            <Text style={[styles.totalsMacro, { color: NUTRIENT_COLORS.protein }]}>
              P {Math.round(totals.protein)}g
            </Text>
            <Text style={[styles.totalsMacro, { color: NUTRIENT_COLORS.carbs }]}>
              C {Math.round(totals.carbs)}g
            </Text>
            <Text style={[styles.totalsMacro, { color: NUTRIENT_COLORS.fat }]}>
              F {Math.round(totals.fat)}g
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Items list */}
          <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>
            Ingredients ({items.length})
          </Text>

          {items.map((item, idx) => (
            <View key={idx} style={[styles.itemRow, { backgroundColor: theme.card, borderColor: theme.separator }]}>
              {editingIdx === idx ? (
                <View>
                  <Text style={[styles.fieldLabel, { color: theme.textTertiary }]}>Food name</Text>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="e.g. Grilled Chicken"
                    placeholderTextColor={theme.textQuaternary}
                    autoFocus
                  />
                  <Text style={[styles.fieldLabel, { color: theme.textTertiary }]}>Portion</Text>
                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
                    value={editPortion}
                    onChangeText={setEditPortion}
                    placeholder="e.g. 1 cup, 200g"
                    placeholderTextColor={theme.textQuaternary}
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={[styles.updateBtn, { backgroundColor: theme.accent }]}
                      onPress={submitEdit}
                      disabled={isUpdating}
                    >
                      {isUpdating ? (
                        <ActivityIndicator size="small" color={theme.text} />
                      ) : (
                        <Text style={styles.updateBtnText}>Update</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.editCancelBtn} onPress={cancelEdit}>
                      <Text style={[styles.editCancelText, { color: theme.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.itemHeader}>
                    <TouchableOpacity
                      style={styles.itemNameArea}
                      onPress={() => startEdit(idx, item)}
                    >
                      <Text style={[styles.itemName, { color: theme.text }]}>
                        {item.name} <Text style={[styles.editHint, { color: theme.textQuaternary }]}>✎</Text>
                      </Text>
                      <Text style={[styles.itemPortion, { color: theme.textTertiary }]}>{item.portion}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.itemCal, { color: theme.accent }]}>{Math.round(item.calories)}</Text>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeItem(idx)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.itemMacros}>
                    <Text style={[styles.macroText, { color: NUTRIENT_COLORS.protein }]}>
                      P {Math.round(item.protein)}g
                    </Text>
                    <Text style={[styles.macroText, { color: NUTRIENT_COLORS.carbs }]}>
                      C {Math.round(item.carbs)}g
                    </Text>
                    <Text style={[styles.macroText, { color: NUTRIENT_COLORS.fat }]}>
                      F {Math.round(item.fat)}g
                    </Text>
                  </View>
                </>
              )}
            </View>
          ))}

          {/* Add ingredient section */}
          {addMode ? (
            <View style={[styles.addCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.fieldLabel, { color: theme.textTertiary }]}>Food name</Text>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
                value={addName}
                onChangeText={setAddName}
                placeholder="e.g. Brown Rice"
                placeholderTextColor={theme.textQuaternary}
                autoFocus
              />
              <Text style={[styles.fieldLabel, { color: theme.textTertiary }]}>Portion (optional)</Text>
              <TextInput
                style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
                value={addPortion}
                onChangeText={setAddPortion}
                placeholder="e.g. 1 cup, 150g"
                placeholderTextColor={theme.textQuaternary}
              />
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.updateBtn, { backgroundColor: theme.accent }]}
                  onPress={submitAdd}
                  disabled={isAdding || !addName.trim()}
                >
                  {isAdding ? (
                    <ActivityIndicator size="small" color={theme.text} />
                  ) : (
                    <Text style={styles.updateBtnText}>Add</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.editCancelBtn} onPress={cancelAdd}>
                  <Text style={[styles.editCancelText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={[styles.addBtn, { borderColor: `${theme.accent}4D` }]} onPress={startAdd}>
              <Text style={[styles.addBtnText, { color: theme.accent }]}>+ Add Ingredient</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerBtn: {
    minWidth: 60,
  },
  saveHeaderBtn: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    color: '#FAFAFA',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '600',
  },
  saveText: {
    color: '#FF6B35',
    fontSize: 15,
    fontWeight: '700',
  },
  saveTextDisabled: {
    opacity: 0.35,
  },
  totalsBar: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  totalsCalories: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FF6B35',
    letterSpacing: -1,
  },
  totalsLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: -2,
  },
  totalsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  totalsMacro: {
    fontSize: 13,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
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
    alignItems: 'center',
  },
  itemNameArea: {
    flex: 1,
  },
  itemName: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '600',
  },
  editHint: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
  },
  itemPortion: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    marginTop: 2,
  },
  itemCal: {
    color: '#FF6B35',
    fontSize: 15,
    fontWeight: '700',
    marginHorizontal: 10,
  },
  removeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,75,75,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtnText: {
    color: '#FF4B4B',
    fontSize: 12,
    fontWeight: '700',
  },
  itemMacros: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  macroText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 6,
  },
  input: {
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
  updateBtn: {
    flex: 1,
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  updateBtnText: {
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
  addCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.2)',
  },
  addBtn: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,107,53,0.3)',
    borderStyle: 'dashed',
  },
  addBtnText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default EditMealModal;