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
  Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { DailyGoals } from '../types/nutrition';
import { getRecentMeals } from '../services/mealStorage';
import { DEFAULT_GOALS, loadGoals, saveGoals, loadWaterGoal, saveWaterGoal, DEFAULT_WATER_GOAL, resetOnboarding, loadNotificationSettings, saveNotificationSettings } from '../services/nutritionGoals';
import { requestPermissions, scheduleReminders } from '../services/notifications';

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
  const [waterGoal, setWaterGoal] = useState(DEFAULT_WATER_GOAL);
  const [saving, setSaving] = useState(false);
  const [lunchReminder, setLunchReminder] = useState(false);
  const [dinnerReminder, setDinnerReminder] = useState(false);

  const handleExport = async () => {
    try {
      const meals = await getRecentMeals(1000);
      if (meals.length === 0) {
        Alert.alert('No Data', 'No meals to export yet.');
        return;
      }

      let csv = 'Date,Time,Meal Type,Items,Calories,Protein(g),Carbs(g),Fat(g),Fiber(g),Sugar(g),Notes\n';
      for (const meal of meals) {
        const date = new Date(meal.timestamp);
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const items = meal.items.map((i: any) => i.name).join('; ');
        csv += `${dateStr},${timeStr},${meal.mealType},"${items}",${Math.round(meal.totals.calories)},${Math.round(meal.totals.protein)},${Math.round(meal.totals.carbs)},${Math.round(meal.totals.fat)},${Math.round(meal.totals.fiber)},${Math.round(meal.totals.sugar)},"${meal.notes ?? ''}"\n`;
      }

      const file = new File(Paths.cache, 'calorie-tracker-export.csv');
      file.create();
      file.write(csv);

      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Meal History',
      });
    } catch (e) {
      Alert.alert('Export Failed', 'Could not export data. Please try again.');
    }
  };

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const [loaded, loadedWater, notifSettings] = await Promise.all([loadGoals(), loadWaterGoal(), loadNotificationSettings()]);
        setGoals(loaded);
        setWaterGoal(loadedWater);
        setLunchReminder(notifSettings.lunch);
        setDinnerReminder(notifSettings.dinner);
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
      await saveWaterGoal(waterGoal);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

          {/* Water Goal Section */}
          <Text style={styles.sectionTitle}>Water Goal</Text>
          <View style={styles.card}>
            <View style={styles.goalRow}>
              <Text style={styles.goalLabel}>
                Daily Target <Text style={styles.goalUnit}>(ml)</Text>
              </Text>
              <TextInput
                style={styles.goalInput}
                value={waterGoal.toString()}
                onChangeText={(t) => { const n = parseInt(t, 10); if (!isNaN(n)) setWaterGoal(n); }}
                keyboardType="numeric"
                selectTextOnFocus
              />
            </View>
          </View>

          {/* Reminders Section */}
          <Text style={styles.sectionTitle}>Reminders</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.goalRow, styles.goalRowBorder]}
              onPress={async () => {
                const newVal = !lunchReminder;
                setLunchReminder(newVal);
                const settings = { lunch: newVal, dinner: dinnerReminder };
                if (newVal || dinnerReminder) await requestPermissions();
                await scheduleReminders(settings);
                await saveNotificationSettings(settings);
              }}
            >
              <Text style={styles.goalLabel}>Lunch Reminder <Text style={styles.goalUnit}>(12:30 PM)</Text></Text>
              <Text style={[styles.toggleText, lunchReminder && styles.toggleActive]}>
                {lunchReminder ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.goalRow}
              onPress={async () => {
                const newVal = !dinnerReminder;
                setDinnerReminder(newVal);
                const settings = { lunch: lunchReminder, dinner: newVal };
                if (lunchReminder || newVal) await requestPermissions();
                await scheduleReminders(settings);
                await saveNotificationSettings(settings);
              }}
            >
              <Text style={styles.goalLabel}>Dinner Reminder <Text style={styles.goalUnit}>(7:00 PM)</Text></Text>
              <Text style={[styles.toggleText, dinnerReminder && styles.toggleActive]}>
                {dinnerReminder ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* About Section */}
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <View style={[styles.aboutRow, styles.goalRowBorder]}>
              <Text style={styles.aboutLabel}>App Version</Text>
              <Text style={styles.aboutValue}>{Constants.expoConfig?.version ?? '1.0.0'}</Text>
            </View>
            <TouchableOpacity style={[styles.aboutRow, styles.goalRowBorder]} onPress={handleExport}>
              <Text style={styles.aboutLabel}>Export Data</Text>
              <Text style={styles.aboutLink}>CSV →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.aboutRow, styles.goalRowBorder]} onPress={() => Linking.openURL('https://github.com')}>
              <Text style={styles.aboutLabel}>Privacy Policy</Text>
              <Text style={styles.aboutLink}>View →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.aboutRow}
              onPress={() => {
                Alert.alert(
                  'Redo Onboarding',
                  'This will restart the setup wizard to recalculate your goals. Continue?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Redo',
                      onPress: async () => {
                        await resetOnboarding();
                        Alert.alert('Done', 'Close and reopen the app to start onboarding.');
                      },
                    },
                  ]
                );
              }}
            >
              <Text style={styles.aboutLabel}>Redo Onboarding</Text>
              <Text style={styles.aboutLink}>Reset →</Text>
            </TouchableOpacity>
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
  toggleText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
    fontWeight: '700',
  },
  toggleActive: {
    color: '#FF6B35',
  },
  aboutLink: {
    color: '#FF6B35',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default SettingsScreen;
