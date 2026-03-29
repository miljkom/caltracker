import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../services/theme';

interface Props {
  current: number;
  goal: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
  unit?: string;
}

const NutrientRing: React.FC<Props> = ({
  current,
  goal,
  size = 100,
  strokeWidth = 8,
  color,
  label,
  unit = '',
}) => {
  const { theme, themeName } = useTheme();
  const trackColor = themeName === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetProgress = Math.min(current / goal, 1);

  // Simple JS-based animation — always animates from 0 on mount
  const [displayProgress, setDisplayProgress] = useState(0);
  const animRef = useRef<ReturnType<typeof requestAnimationFrame>>();
  const mountRef = useRef(0);

  useEffect(() => {
    // Reset to 0 and animate up every time targetProgress changes
    mountRef.current++;
    const thisMount = mountRef.current;
    setDisplayProgress(0);

    // Small delay so the reset to 0 renders first
    const timeout = setTimeout(() => {
      if (thisMount !== mountRef.current) return;
      const duration = 600;
      const startTime = Date.now();

      const animate = () => {
        if (thisMount !== mountRef.current) return;
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplayProgress(targetProgress * eased);

        if (t < 1) {
          animRef.current = requestAnimationFrame(animate);
        }
      };

      animRef.current = requestAnimationFrame(animate);
    }, 50);

    return () => {
      clearTimeout(timeout);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [targetProgress]);

  const strokeDashoffset = circumference * (1 - displayProgress);
  const isOver = current > goal;

  return (
    <View style={[styles.container, { width: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isOver ? '#FF4444' : color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[styles.labelContainer, { width: size, height: size }]}>
        <Text style={[styles.value, { color: isOver ? '#FF4444' : theme.text }]}>
          {Math.round(current)}
        </Text>
        <Text style={[styles.label, { color: theme.textTertiary }]}>{label}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  svg: {
    transform: [{ rotateZ: '0deg' }],
  },
  labelContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 1,
  },
});

export default NutrientRing;
