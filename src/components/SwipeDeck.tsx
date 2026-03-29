import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { MealSuggestionCard } from '../types/mealPlan';
import SwipeCard from './SwipeCard';
import { useTheme } from '../services/theme';

interface Props {
  suggestions: MealSuggestionCard[];
  loading: boolean;
  onAccept: (suggestion: MealSuggestionCard) => void;
  onReject: (suggestion: MealSuggestionCard) => void;
  onRequestMore: () => void;
}

const SwipeDeck: React.FC<Props> = ({
  suggestions,
  loading,
  onAccept,
  onReject,
  onRequestMore,
}) => {
  const { theme } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset index when suggestions change
  React.useEffect(() => {
    setCurrentIndex(0);
  }, [suggestions]);

  const current = suggestions[currentIndex];
  const isFinished = !current && !loading;

  const advance = useCallback(() => {
    setCurrentIndex((prev) => prev + 1);
  }, []);

  const handleSwipeRight = useCallback(() => {
    if (current) onAccept(current);
    advance();
  }, [current, onAccept, advance]);

  const handleSwipeLeft = useCallback(() => {
    if (current) onReject(current);
    advance();
  }, [current, onReject, advance]);

  // Loading state
  if (loading && !current) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Finding meal ideas for you...
        </Text>
      </View>
    );
  }

  // Empty / finished state
  if (isFinished) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🎉</Text>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>All caught up!</Text>
        <Text style={[styles.emptySubtext, { color: theme.textTertiary }]}>
          Check your plan below or get more ideas
        </Text>
        <TouchableOpacity
          style={[styles.moreBtn, { backgroundColor: theme.accent }]}
          onPress={onRequestMore}
        >
          <Text style={styles.moreBtnText}>Get More Suggestions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      {/* Key forces fresh component mount per card — clean animated values */}
      <SwipeCard
        key={`card-${currentIndex}`}
        suggestion={current}
        onSwipeRight={handleSwipeRight}
        onSwipeLeft={handleSwipeLeft}
      />

      {/* Counter */}
      <View style={styles.counterRow}>
        <Text style={[styles.counterText, { color: theme.textTertiary }]}>
          {currentIndex + 1} / {suggestions.length}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  moreBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  moreBtnText: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '700',
  },
  counterRow: {
    alignItems: 'center',
    marginTop: 12,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default SwipeDeck;
