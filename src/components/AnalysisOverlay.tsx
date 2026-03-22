import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { AnalysisResult } from '../types/nutrition';
import { NUTRIENT_COLORS } from '../services/nutritionGoals';

interface Props {
  photoUri: string;
  result: AnalysisResult | null;
  isAnalyzing: boolean;
  error: string | null;
  onSave: () => void;
  onRetake: () => void;
}

const AnalysisOverlay: React.FC<Props> = ({
  photoUri,
  result,
  isAnalyzing,
  error,
  onSave,
  onRetake,
}) => (
  <View style={styles.container}>
    <Image source={{ uri: photoUri }} style={styles.preview} />

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

          {/* Individual items */}
          <Text style={styles.sectionTitle}>Detected Items</Text>
          {result.items.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemCal}>{Math.round(item.calories)} kcal</Text>
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
                  ⚡ Low confidence — tap to adjust
                </Text>
              )}
            </View>
          ))}

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
              <Text style={styles.saveBtnText}>Log This Meal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.retakeBtn} onPress={onRetake}>
              <Text style={styles.retakeBtnText}>Retake Photo</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  </View>
);

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
    paddingBottom: 40,
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
  lowConfidence: {
    color: '#FFD93D',
    fontSize: 11,
    marginTop: 6,
    fontWeight: '500',
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
