import React, { useRef, useCallback } from 'react';
import { Dimensions, StyleSheet, Animated, PanResponder } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MealSuggestionCard } from '../types/mealPlan';
import SuggestionCardContent from './SuggestionCardContent';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

interface Props {
  suggestion: MealSuggestionCard;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
}

const SwipeCard: React.FC<Props> = ({ suggestion, onSwipeLeft, onSwipeRight, onSwipeStart, onSwipeEnd }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const hapticFired = useRef(false);
  const swiped = useRef(false);

  const handleRight = useCallback(() => {
    if (swiped.current) return;
    swiped.current = true;
    onSwipeRight();
  }, [onSwipeRight]);

  const handleLeft = useCallback(() => {
    if (swiped.current) return;
    swiped.current = true;
    onSwipeLeft();
  }, [onSwipeLeft]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 5 && Math.abs(g.dx) > Math.abs(g.dy),
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        onSwipeStart?.();
      },
      onPanResponderMove: (_, g) => {
        translateX.setValue(g.dx);
        if (Math.abs(g.dx) > SWIPE_THRESHOLD && !hapticFired.current) {
          hapticFired.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else if (Math.abs(g.dx) <= SWIPE_THRESHOLD) {
          hapticFired.current = false;
        }
      },
      onPanResponderRelease: (_, g) => {
        hapticFired.current = false;
        onSwipeEnd?.();
        if (g.dx > SWIPE_THRESHOLD) {
          Animated.timing(translateX, {
            toValue: SCREEN_WIDTH * 1.5,
            duration: 200,
            useNativeDriver: true,
          }).start(handleRight);
        } else if (g.dx < -SWIPE_THRESHOLD) {
          Animated.timing(translateX, {
            toValue: -SCREEN_WIDTH * 1.5,
            duration: 200,
            useNativeDriver: true,
          }).start(handleLeft);
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 7,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        onSwipeEnd?.();
      },
    })
  ).current;

  const rotation = translateX.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-12deg', '0deg', '12deg'],
    extrapolate: 'clamp',
  });

  const acceptOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const rejectOpacity = translateX.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateX }, { rotate: rotation }] },
      ]}
      {...panResponder.panHandlers}
    >
      <Animated.View style={[styles.overlay, styles.acceptOverlay, { opacity: acceptOpacity }]}>
        <Animated.Text style={styles.acceptText}>PLAN IT</Animated.Text>
      </Animated.View>

      <Animated.View style={[styles.overlay, styles.rejectOverlay, { opacity: rejectOpacity }]}>
        <Animated.Text style={styles.rejectText}>SKIP</Animated.Text>
      </Animated.View>

      <SuggestionCardContent suggestion={suggestion} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH - 40,
    alignSelf: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 20,
    zIndex: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
  },
  acceptOverlay: {
    right: 20,
    borderColor: '#4ECDC4',
    backgroundColor: 'rgba(78,205,196,0.15)',
  },
  rejectOverlay: {
    left: 20,
    borderColor: '#FF4B4B',
    backgroundColor: 'rgba(255,75,75,0.15)',
  },
  acceptText: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  rejectText: {
    color: '#FF4B4B',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
});

export default SwipeCard;
