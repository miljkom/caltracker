import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { DailyGoals } from '../types/nutrition';
import { DEFAULT_GOALS, loadGoals, saveGoals } from '../services/nutritionGoals';

type GoalKey = keyof DailyGoals;

const GOAL_FIELDS: { key: GoalKey; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sugar', label: 'Sugar', unit: 'g' },
];

const SettingsScreen: React.FC = () => {
  const [goals, setGoals] = useState<DailyGoals>({ ...DEFAULT_GOALS });
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const loaded = await loadGoals();
        setGoals(loaded);
      };
      load();
    }, [])
  );

  const updateGoal = (key: GoalKey, text: string) => {
    const num = text === '' ? 0 : parseInt(text, 10);
    if (!isNaN(num)) {
      setGoals((prev) => ({ ...prev, [key]: num }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveGoals(goals);
      Alert.alert('Saved', 'Your daily goals have been updated.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save goals. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Settings</Text>

          {/* Daily Goals Section */}
          <Text style={styles.sectionTitle}>Daily Goals</Text>
          <View style={styles.card}>
            {GOAL_FIELDS.map((field, index) => (
              <View
                key={field.key}
                style={[
                  styles.goalRow,
                  index < GOAL_FIELDS.length - 1 && styles.goalRowBorder,
                ]}
              >
                <Text style={styles.goalLabel}>
                  {field.label}{' '}
                  <Text style={styles.goalUnit}>({field.unit})</Text>
                </Text>
                <TextInput
                  style={styles.goalInput}
                  value={goals[field.key].toString()}
                  onChangeText={(text) => updateGoal(field.key, text)}
                  keyboardType="numeric"
                  selectTextOnFocus
                  placeholderTextColor="rgba(255,255,255,0.2)"
                />
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.75}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>

          {/* About Section */}
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <View style={[styles.aboutRow, styles.goalRowBorder]}>
              <Text style={styles.aboutLabel}>App Version</Text>
              <Text style={styles.aboutValue}>1.0.0</Text>
            </View>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Privacy Policy</Text>
              <Text style={styles.aboutLink}>View</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
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
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 28,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 20,
    overflow: 'hidden',
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  goalRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  goalLabel: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '500',
  },
  goalUnit: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    fontWeight: '400',
  },
  goalInput: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 80,
    textAlign: 'right',
  },
  saveButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FAFAFA',
    fontSize: 16,
    fontWeight: '700',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  aboutLabel: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '500',
  },
  aboutValue: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '500',
  },
  aboutLink: {
    color: '#FF6B35',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default SettingsScreen;
