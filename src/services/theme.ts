import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'calorie_tracker.db';

export const themes = {
  dark: {
    background: '#0A0A0A',
    card: 'rgba(255,255,255,0.05)',
    cardBorder: 'rgba(255,255,255,0.06)',
    text: '#FAFAFA',
    textSecondary: 'rgba(255,255,255,0.55)',
    textTertiary: 'rgba(255,255,255,0.35)',
    textQuaternary: 'rgba(255,255,255,0.25)',
    accent: '#FF6B35',
    tabBar: '#0A0A0A',
    tabBorder: 'rgba(255,255,255,0.06)',
    inputBg: 'rgba(255,255,255,0.08)',
    inputBorder: 'rgba(255,255,255,0.12)',
    overlay: 'rgba(0,0,0,0.6)',
    pillBg: 'rgba(255,255,255,0.04)',
    separator: 'rgba(255,255,255,0.06)',
    chartBar: 'rgba(255,255,255,0.15)',
    chartLabel: 'rgba(255,255,255,0.35)',
  },
  light: {
    background: '#F5F5F5',
    card: '#FFFFFF',
    cardBorder: 'rgba(0,0,0,0.08)',
    text: '#1A1A1A',
    textSecondary: 'rgba(0,0,0,0.55)',
    textTertiary: 'rgba(0,0,0,0.35)',
    textQuaternary: 'rgba(0,0,0,0.2)',
    accent: '#FF6B35',
    tabBar: '#FFFFFF',
    tabBorder: 'rgba(0,0,0,0.08)',
    inputBg: 'rgba(0,0,0,0.05)',
    inputBorder: 'rgba(0,0,0,0.12)',
    overlay: 'rgba(0,0,0,0.4)',
    pillBg: 'rgba(0,0,0,0.04)',
    separator: 'rgba(0,0,0,0.08)',
    chartBar: 'rgba(0,0,0,0.1)',
    chartLabel: 'rgba(0,0,0,0.4)',
  },
};

export type ThemeType = typeof themes.dark;
export type ThemeName = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeType;
  themeName: ThemeName;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: themes.dark,
  themeName: 'dark',
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const loadTheme = async (): Promise<ThemeName> => {
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    await db.execAsync('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      ['theme']
    );
    if (row?.value === 'light') return 'light';
  } catch (e) {
    console.warn('Theme load failed:', e);
  }
  return 'dark';
};

export const saveTheme = async (name: ThemeName): Promise<void> => {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['theme', name]
  );
};
