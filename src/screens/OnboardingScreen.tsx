import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { DailyGoals } from '../types/nutrition';
import { saveGoals } from '../services/nutritionGoals';

interface OnboardingScreenProps {
  onComplete: () => void;
}

const TOTAL_STEPS = 5;

const calculateGoals = (
  gender: string,
  goal: string,
  activity: string,
  age: number,
  weight: number,
  height: number,
): DailyGoals => {
  // BMR (Mifflin-St Jeor)
  let bmr: number;
  if (gender === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }

  // Activity multiplier
  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    very: 1.725,
  };
  let tdee = bmr * (activityMultipliers[activity] ?? 1.2);

  // Goal adjustment
  if (goal === 'lose') tdee -= 500;
  if (goal === 'gain') tdee += 300;

  const calories = Math.round(tdee);

  // Macro split based on goal
  let proteinRatio: number, carbRatio: number, fatRatio: number;
  if (goal === 'lose') {
    proteinRatio = 0.35;
    carbRatio = 0.35;
    fatRatio = 0.3;
  } else if (goal === 'gain') {
    proteinRatio = 0.3;
    carbRatio = 0.45;
    fatRatio = 0.25;
  } else {
    proteinRatio = 0.3;
    carbRatio = 0.4;
    fatRatio = 0.3;
  }

  return {
    calories,
    protein: Math.round((calories * proteinRatio) / 4),
    carbs: Math.round((calories * carbRatio) / 4),
    fat: Math.round((calories * fatRatio) / 9),
    fiber: 30,
    sugar: 50,
  };
};

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [gender, setGender] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [activity, setActivity] = useState<string | null>(null);
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [saving, setSaving] = useState(false);

  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return gender !== null;
      case 1:
        return goal !== null;
      case 2:
        return activity !== null;
      case 3:
        return age !== '' && weight !== '' && height !== '' &&
          Number(age) > 0 && Number(weight) > 0 && Number(height) > 0;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const calculatedGoals = gender && goal && activity && Number(age) > 0 && Number(weight) > 0 && Number(height) > 0
    ? calculateGoals(gender, goal, activity, Number(age), Number(weight), Number(height))
    : null;

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleGetStarted = async () => {
    if (!calculatedGoals || saving) return;
    setSaving(true);
    try {
      await saveGoals(calculatedGoals);
      onComplete();
    } catch {
      setSaving(false);
    }
  };

  const renderSelectionCard = (
    icon: string,
    label: string,
    description: string | null,
    isSelected: boolean,
    onPress: () => void,
  ) => (
    <TouchableOpacity
      key={label}
      style={[styles.selectionCard, isSelected && styles.selectionCardSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.selectionIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.selectionLabel}>{label}</Text>
        {description && <Text style={styles.selectionDesc}>{description}</Text>}
      </View>
      {isSelected && <Text style={styles.checkmark}>{'✓'}</Text>}
    </TouchableOpacity>
  );

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>About You</Text>
            <Text style={styles.stepSubtitle}>This helps us calculate your daily goals</Text>
            <View style={styles.cardsContainer}>
              {renderSelectionCard(
                '\u{1F468}',
                'Male',
                null,
                gender === 'male',
                () => setGender('male'),
              )}
              {renderSelectionCard(
                '\u{1F469}',
                'Female',
                null,
                gender === 'female',
                () => setGender('female'),
              )}
            </View>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>What's your goal?</Text>
            <View style={styles.cardsContainer}>
              {renderSelectionCard(
                '\u{1F525}',
                'Lose Weight',
                null,
                goal === 'lose',
                () => setGoal('lose'),
              )}
              {renderSelectionCard(
                '\u2696\uFE0F',
                'Maintain Weight',
                null,
                goal === 'maintain',
                () => setGoal('maintain'),
              )}
              {renderSelectionCard(
                '\u{1F4AA}',
                'Gain Weight/Muscle',
                null,
                goal === 'gain',
                () => setGoal('gain'),
              )}
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>How active are you?</Text>
            <View style={styles.cardsContainer}>
              {renderSelectionCard(
                '\u{1FA91}',
                'Sedentary',
                'Desk job, little exercise',
                activity === 'sedentary',
                () => setActivity('sedentary'),
              )}
              {renderSelectionCard(
                '\u{1F6B6}',
                'Lightly Active',
                'Light exercise 1-3 days/week',
                activity === 'light',
                () => setActivity('light'),
              )}
              {renderSelectionCard(
                '\u{1F3C3}',
                'Moderately Active',
                'Exercise 3-5 days/week',
                activity === 'moderate',
                () => setActivity('moderate'),
              )}
              {renderSelectionCard(
                '\u{1F3CB}\uFE0F',
                'Very Active',
                'Hard exercise 6-7 days/week',
                activity === 'very',
                () => setActivity('very'),
              )}
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Your stats</Text>
            <View style={styles.cardsContainer}>
              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>Age</Text>
                <TextInput
                  style={styles.textInput}
                  value={age}
                  onChangeText={setAge}
                  keyboardType="numeric"
                  placeholder="25"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  selectTextOnFocus
                />
              </View>
              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>Weight (kg)</Text>
                <TextInput
                  style={styles.textInput}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="numeric"
                  placeholder="70"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  selectTextOnFocus
                />
              </View>
              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>Height (cm)</Text>
                <TextInput
                  style={styles.textInput}
                  value={height}
                  onChangeText={setHeight}
                  keyboardType="numeric"
                  placeholder="175"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  selectTextOnFocus
                />
              </View>
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Your Daily Goals</Text>
            {calculatedGoals && (
              <View style={styles.cardsContainer}>
                {([
                  { label: 'Calories', value: calculatedGoals.calories, unit: 'kcal', color: '#FF6B35' },
                  { label: 'Protein', value: calculatedGoals.protein, unit: 'g', color: '#4ECDC4' },
                  { label: 'Carbs', value: calculatedGoals.carbs, unit: 'g', color: '#FFD93D' },
                  { label: 'Fat', value: calculatedGoals.fat, unit: 'g', color: '#FF6B6B' },
                  { label: 'Fiber', value: calculatedGoals.fiber, unit: 'g', color: '#95D5B2' },
                  { label: 'Sugar', value: calculatedGoals.sugar, unit: 'g', color: '#DDA0DD' },
                ] as const).map((item) => (
                  <View key={item.label} style={styles.resultCard}>
                    <View style={[styles.resultDot, { backgroundColor: item.color }]} />
                    <Text style={styles.resultLabel}>{item.label}</Text>
                    <Text style={styles.resultValue}>
                      {item.value}
                      <Text style={styles.resultUnit}> {item.unit}</Text>
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  const renderProgressDots = () => (
    <View style={styles.dotsContainer}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotCompleted]}
        />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header with back button */}
        <View style={styles.header}>
          {step > 0 ? (
            <TouchableOpacity onPress={handleBack} activeOpacity={0.7}>
              <Text style={styles.backButton}>{'← Back'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>

        {/* Content */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderStep()}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {renderProgressDots()}
          {step < TOTAL_STEPS - 1 ? (
            <TouchableOpacity
              style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
              onPress={handleNext}
              disabled={!canProceed()}
              activeOpacity={0.75}
            >
              <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextButton, saving && styles.nextButtonDisabled]}
              onPress={handleGetStarted}
              disabled={saving}
              activeOpacity={0.75}
            >
              <Text style={styles.nextButtonText}>
                {saving ? 'Saving...' : 'Get Started'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingBottom: 8,
  },
  backButton: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  stepContainer: {
    flex: 1,
    paddingTop: 20,
  },
  stepTitle: {
    color: '#FAFAFA',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  stepSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 24,
  },
  cardsContainer: {
    gap: 12,
    marginTop: 8,
  },
  // Selection cards
  selectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 16,
  },
  selectionCardSelected: {
    backgroundColor: 'rgba(255,107,53,0.15)',
    borderColor: '#FF6B35',
  },
  selectionIcon: {
    fontSize: 28,
  },
  selectionLabel: {
    color: '#FAFAFA',
    fontSize: 17,
    fontWeight: '600',
  },
  selectionDesc: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
  checkmark: {
    color: '#FF6B35',
    fontSize: 20,
    fontWeight: '700',
  },
  // Input cards
  inputCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    color: '#FAFAFA',
    fontSize: 16,
    fontWeight: '500',
  },
  textInput: {
    color: '#FAFAFA',
    fontSize: 18,
    fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 100,
    textAlign: 'right',
  },
  // Result cards
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  resultDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 14,
  },
  resultLabel: {
    color: '#FAFAFA',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  resultValue: {
    color: '#FAFAFA',
    fontSize: 20,
    fontWeight: '700',
  },
  resultUnit: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontWeight: '400',
  },
  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'android' ? 24 : 16,
    paddingTop: 12,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotActive: {
    backgroundColor: '#FF6B35',
    width: 24,
  },
  dotCompleted: {
    backgroundColor: 'rgba(255,107,53,0.5)',
  },
  nextButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  nextButtonDisabled: {
    opacity: 0.4,
  },
  nextButtonText: {
    color: '#FAFAFA',
    fontSize: 17,
    fontWeight: '700',
  },
});

export default OnboardingScreen;
