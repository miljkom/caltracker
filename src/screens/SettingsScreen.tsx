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
import { File, Paths, Directory } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { DailyGoals } from '../types/nutrition';
import { getRecentMeals, getProfileStats, getLoggingStreak } from '../services/mealStorage';
import { DEFAULT_GOALS, loadGoals, saveGoals, loadWaterGoal, saveWaterGoal, DEFAULT_WATER_GOAL, resetOnboarding, loadNotificationSettings, saveNotificationSettings } from '../services/nutritionGoals';
import { requestPermissions, scheduleReminders } from '../services/notifications';
import { useTheme } from '../services/theme';
import { getAchievements, Achievement } from '../services/achievements';

const StatItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.statItem}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

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
  const { theme, themeName, toggleTheme } = useTheme();
  const [goals, setGoals] = useState<DailyGoals>({ ...DEFAULT_GOALS });
  const [waterGoal, setWaterGoal] = useState(DEFAULT_WATER_GOAL);
  const [saving, setSaving] = useState(false);
  const [lunchReminder, setLunchReminder] = useState(false);
  const [dinnerReminder, setDinnerReminder] = useState(false);
  const [profileStats, setProfileStats] = useState({ totalMeals: 0, totalCalories: 0, daysActive: 0, avgCalories: 0, memberSince: null as number | null });
  const [streak, setStreak] = useState(0);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

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

  const handleBackup = async () => {
    try {
      const dbPath = `${Paths.document.uri}/SQLite/calorie_tracker.db`;
      const dbFile = new File(dbPath);
      if (!dbFile.exists) {
        Alert.alert('No Data', 'No database found to backup.');
        return;
      }
      await Sharing.shareAsync(dbPath, {
        mimeType: 'application/x-sqlite3',
        dialogTitle: 'Backup Calorie Tracker Data',
        UTI: 'public.database',
      });
    } catch (e) {
      Alert.alert('Backup Failed', 'Could not create backup. Please try again.');
    }
  };

  const handleRestore = async () => {
    Alert.alert(
      'Restore Data',
      'This will replace ALL current data with the backup. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
              });
              if (result.canceled || !result.assets?.[0]) return;

              const pickedFile = new File(result.assets[0].uri);
              const dbDir = new Directory(Paths.document, 'SQLite');
              if (!dbDir.exists) dbDir.create();
              const destFile = new File(dbDir, 'calorie_tracker.db');

              // Copy picked file to DB location
              const buffer = await pickedFile.arrayBuffer();
              destFile.create();
              destFile.write(new Uint8Array(buffer));

              Alert.alert('Restored', 'Data restored successfully. Please restart the app.');
            } catch (e) {
              Alert.alert('Restore Failed', 'Could not restore backup. Make sure you selected a valid backup file.');
            }
          },
        },
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const [loaded, loadedWater, notifSettings, stats, currentStreak, achs] = await Promise.all([loadGoals(), loadWaterGoal(), loadNotificationSettings(), getProfileStats(), getLoggingStreak(), getAchievements()]);
        setGoals(loaded);
        setWaterGoal(loadedWater);
        setLunchReminder(notifSettings.lunch);
        setDinnerReminder(notifSettings.dinner);
        setProfileStats(stats);
        setStreak(currentStreak);
        setAchievements(achs);
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
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

          {/* Daily Goals Section */}
          <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>Daily Goals</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            {GOAL_FIELDS.map((field, index) => (
              <View
                key={field.key}
                style={[
                  styles.goalRow,
                  index < GOAL_FIELDS.length - 1 && styles.goalRowBorder,
                ]}
              >
                <Text style={[styles.goalLabel, { color: theme.text }]}>
                  {field.label}{' '}
                  <Text style={styles.goalUnit}>({field.unit})</Text>
                </Text>
                <TextInput
                  style={[styles.goalInput, { color: theme.text, backgroundColor: theme.inputBg }]}
                  value={goals[field.key].toString()}
                  onChangeText={(text) => updateGoal(field.key, text)}
                  keyboardType="numeric"
                  selectTextOnFocus
                  placeholderTextColor={theme.textTertiary}
                />
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            accessibilityLabel="Save settings" accessibilityRole="button"
            disabled={saving}
            activeOpacity={0.75}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>

          {/* Water Goal Section */}
          <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>Water Goal</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.goalRow}>
              <Text style={[styles.goalLabel, { color: theme.text }]}>
                Daily Target <Text style={styles.goalUnit}>(ml)</Text>
              </Text>
              <TextInput
                style={[styles.goalInput, { color: theme.text, backgroundColor: theme.inputBg }]}
                value={waterGoal.toString()}
                onChangeText={(t) => { const n = parseInt(t, 10); if (!isNaN(n)) setWaterGoal(n); }}
                keyboardType="numeric"
                selectTextOnFocus
              />
            </View>
          </View>

          {/* Reminders Section */}
          <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>Reminders</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <TouchableOpacity
              style={[styles.goalRow, styles.goalRowBorder]}
              accessibilityLabel="Toggle lunch reminder" accessibilityRole="button"
              onPress={async () => {
                const newVal = !lunchReminder;
                setLunchReminder(newVal);
                const settings = { lunch: newVal, dinner: dinnerReminder };
                if (newVal || dinnerReminder) await requestPermissions();
                await scheduleReminders(settings);
                await saveNotificationSettings(settings);
              }}
            >
              <Text style={[styles.goalLabel, { color: theme.text }]}>Lunch Reminder <Text style={styles.goalUnit}>(12:30 PM)</Text></Text>
              <Text style={[styles.toggleText, lunchReminder && styles.toggleActive]}>
                {lunchReminder ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.goalRow}
              accessibilityLabel="Toggle dinner reminder" accessibilityRole="button"
              onPress={async () => {
                const newVal = !dinnerReminder;
                setDinnerReminder(newVal);
                const settings = { lunch: lunchReminder, dinner: newVal };
                if (lunchReminder || newVal) await requestPermissions();
                await scheduleReminders(settings);
                await saveNotificationSettings(settings);
              }}
            >
              <Text style={[styles.goalLabel, { color: theme.text }]}>Dinner Reminder <Text style={styles.goalUnit}>(7:00 PM)</Text></Text>
              <Text style={[styles.toggleText, dinnerReminder && styles.toggleActive]}>
                {dinnerReminder ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Appearance Section */}
          <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>Appearance</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <TouchableOpacity style={styles.goalRow} onPress={toggleTheme}>
              <Text style={[styles.goalLabel, { color: theme.text }]}>Theme</Text>
              <Text style={[styles.toggleText, { color: theme.accent }]}>
                {themeName === 'dark' ? '🌙 Dark' : '☀️ Light'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Home Screen Widget Section */}
          <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>Home Screen Widget</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.aboutRow}>
              <Text style={[styles.aboutLabel, { color: theme.text }]}>Status</Text>
              <Text style={styles.aboutValue}>Coming Soon</Text>
            </View>
          </View>

          {/* Your Stats Section */}
          <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>Your Stats</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.statsGrid}>
              <StatItem label="Total Meals" value={profileStats.totalMeals.toString()} />
              <StatItem label="Days Active" value={profileStats.daysActive.toString()} />
              <StatItem label="Total Calories" value={profileStats.totalCalories.toLocaleString()} />
              <StatItem label="Daily Average" value={`${profileStats.avgCalories} kcal`} />
              <StatItem label="Current Streak" value={streak > 0 ? `${streak} days` : '\u2014'} />
              <StatItem label="Member Since" value={profileStats.memberSince ? new Date(profileStats.memberSince).toLocaleDateString() : '\u2014'} />
            </View>
          </View>

          {/* Achievements Section */}
          <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>Achievements</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.achievementsGrid}>
              {achievements.map((a) => (
                <View key={a.id} style={[styles.achievementItem, !a.earned && styles.achievementLocked]}>
                  <Text style={styles.achievementIcon}>{a.earned ? a.icon : '🔒'}</Text>
                  <Text style={[styles.achievementName, !a.earned && styles.achievementNameLocked]}>{a.name}</Text>
                  <Text style={styles.achievementDesc}>{a.description}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* About Section */}
          <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>About</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={[styles.aboutRow, styles.goalRowBorder]}>
              <Text style={[styles.aboutLabel, { color: theme.text }]}>App Version</Text>
              <Text style={styles.aboutValue}>{Constants.expoConfig?.version ?? '1.0.0'}</Text>
            </View>
            <TouchableOpacity style={[styles.aboutRow, styles.goalRowBorder]} onPress={handleExport}>
              <Text style={[styles.aboutLabel, { color: theme.text }]}>Export Data</Text>
              <Text style={styles.aboutLink}>CSV →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.aboutRow, styles.goalRowBorder]} onPress={handleBackup} accessibilityLabel="Backup data" accessibilityRole="button">
              <Text style={[styles.aboutLabel, { color: theme.text }]}>Backup Data</Text>
              <Text style={styles.aboutLink}>Export →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.aboutRow, styles.goalRowBorder]} onPress={handleRestore} accessibilityLabel="Restore data" accessibilityRole="button">
              <Text style={[styles.aboutLabel, { color: theme.text }]}>Restore Data</Text>
              <Text style={styles.aboutLink}>Import →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.aboutRow, styles.goalRowBorder]} onPress={() => Linking.openURL('https://github.com')}>
              <Text style={[styles.aboutLabel, { color: theme.text }]}>Privacy Policy</Text>
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
              <Text style={[styles.aboutLabel, { color: theme.text }]}>Redo Onboarding</Text>
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    padding: 14,
    alignItems: 'center',
  },
  statValue: {
    color: '#FF6B35',
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  achievementItem: {
    width: '50%',
    padding: 12,
    alignItems: 'center',
  },
  achievementLocked: {
    opacity: 0.35,
  },
  achievementIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  achievementName: {
    color: '#FAFAFA',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  achievementNameLocked: {
    color: 'rgba(255,255,255,0.5)',
  },
  achievementDesc: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
});

export default SettingsScreen;
