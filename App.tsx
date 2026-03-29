import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, Animated } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import DashboardScreen from './src/screens/DashboardScreen';
import ScanScreen from './src/screens/ScanScreen';
import MealPlannerScreen from './src/screens/MealPlannerScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import { isOnboardingComplete, setOnboardingComplete } from './src/services/nutritionGoals';
import { ThemeContext, themes, loadTheme, saveTheme, ThemeName, useTheme } from './src/services/theme';

// Keep splash screen visible while we load
SplashScreen.preventAutoHideAsync();

const Tab = createBottomTabNavigator();

const TabIcon: React.FC<{ icon: string; label: string; focused: boolean }> = ({
  icon,
  label,
  focused,
}) => {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(focused ? 1 : 0.85)).current;
  const opacity = useRef(new Animated.Value(focused ? 1 : 0.4)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: focused ? 1 : 0.85, useNativeDriver: true, friction: 6 }),
      Animated.timing(opacity, { toValue: focused ? 1 : 0.4, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [focused]);

  return (
    <Animated.View
      style={[styles.tabIconContainer, { transform: [{ scale }], opacity }]}
      accessibilityLabel={label}
      accessibilityRole="tab"
    >
      <Text style={styles.tabIcon}>{icon}</Text>
      <Text style={[styles.tabLabel, { color: theme.textTertiary }, focused && styles.tabLabelFocused]} numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );
};

const ScanTabButton: React.FC<{ focused: boolean }> = ({ focused }) => {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(focused ? 1.08 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: focused ? 1.08 : 1, useNativeDriver: true, friction: 5 }).start();
  }, [focused]);

  return (
    <View style={styles.scanTabContainer} accessibilityLabel="Scan" accessibilityRole="tab">
      <Animated.View style={[styles.scanTabBtn, focused && styles.scanTabBtnFocused, { transform: [{ scale }] }]}>
        <Text style={styles.scanTabIcon}>📸</Text>
      </Animated.View>
      <Text style={[styles.tabLabel, { color: theme.textTertiary }, focused && styles.tabLabelFocused, { marginTop: 4 }]}>
        Scan
      </Text>
    </View>
  );
};

const App: React.FC = () => {
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [themeName, setThemeName] = useState<ThemeName>('dark');

  useEffect(() => {
    Promise.all([isOnboardingComplete(), loadTheme()]).then(([done, savedTheme]) => {
      setShowOnboarding(!done);
      setThemeName(savedTheme);
      SplashScreen.hideAsync();
    });
  }, []);

  const toggleTheme = () => {
    const newTheme = themeName === 'dark' ? 'light' : 'dark';
    setThemeName(newTheme);
    saveTheme(newTheme);
  };

  if (showOnboarding === null) {
    // Splash screen is still visible, render nothing
    return null;
  }

  if (showOnboarding) {
    return (
      <OnboardingScreen
        onComplete={async () => {
          await setOnboardingComplete();
          setShowOnboarding(false);
        }}
      />
    );
  }

  return (
    <ThemeContext.Provider value={{ theme: themes[themeName], themeName, toggleTheme }}>
      <ErrorBoundary>
          <NavigationContainer>
            <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
            <Tab.Navigator
              screenOptions={{
                headerShown: false,
                tabBarStyle: {
                  ...styles.tabBar,
                  backgroundColor: themes[themeName].tabBar,
                  borderTopColor: themes[themeName].tabBorder,
                },
                tabBarShowLabel: false,
                lazy: false,
              }}
            >
              <Tab.Screen
                name="Dashboard"
                component={DashboardScreen}
                options={{
                  tabBarIcon: ({ focused }) => (
                    <TabIcon icon="🏠" label="Today" focused={focused} />
                  ),
                }}
              />
              <Tab.Screen
                name="Scan"
                component={ScanScreen}
                options={{
                  tabBarIcon: ({ focused }) => <ScanTabButton focused={focused} />,
                }}
              />
              <Tab.Screen
                name="Plan"
                component={MealPlannerScreen}
                options={{
                  tabBarIcon: ({ focused }) => (
                    <TabIcon icon="🍽️" label="Plan" focused={focused} />
                  ),
                }}
              />
              <Tab.Screen
                name="History"
                component={HistoryScreen}
                options={{
                  tabBarIcon: ({ focused }) => (
                    <TabIcon icon="📋" label="Log" focused={focused} />
                  ),
                }}
              />
              <Tab.Screen
                name="Settings"
                component={SettingsScreen}
                options={{
                  tabBarIcon: ({ focused }) => (
                    <TabIcon icon="⚙️" label="Settings" focused={focused} />
                  ),
                }}
              />
            </Tab.Navigator>
          </NavigationContainer>
      </ErrorBoundary>
    </ThemeContext.Provider>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    height: 88,
    paddingTop: 8,
    position: 'absolute',
    elevation: 0,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  tabIcon: {
    fontSize: 20,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    marginTop: 2,
  },
  tabLabelFocused: {
    color: '#FF6B35',
  },
  // Elevated scan button
  scanTabContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  scanTabBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  scanTabBtnFocused: {
    shadowOpacity: 0.55,
    transform: [{ scale: 1.05 }],
  },
  scanTabIcon: {
    fontSize: 24,
  },
});

export default App;
