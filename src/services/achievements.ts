import { getProfileStats, getLoggingStreak } from './mealStorage';

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  description: string;
  earned: boolean;
}

interface Stats {
  totalMeals: number;
  daysActive: number;
  streak: number;
}

const ACHIEVEMENT_DEFS = [
  { id: 'first_scan', icon: '📸', name: 'First Scan', description: 'Log your first meal', check: (s: Stats) => s.totalMeals >= 1 },
  { id: 'five_meals', icon: '🍽️', name: 'Getting Started', description: 'Log 5 meals', check: (s: Stats) => s.totalMeals >= 5 },
  { id: 'twenty_meals', icon: '🔥', name: 'On a Roll', description: 'Log 20 meals', check: (s: Stats) => s.totalMeals >= 20 },
  { id: 'fifty_meals', icon: '💯', name: 'Committed', description: 'Log 50 meals', check: (s: Stats) => s.totalMeals >= 50 },
  { id: 'hundred_meals', icon: '🏆', name: 'Century Club', description: 'Log 100 meals', check: (s: Stats) => s.totalMeals >= 100 },
  { id: 'streak_3', icon: '⚡', name: '3-Day Streak', description: 'Log meals 3 days in a row', check: (s: Stats) => s.streak >= 3 },
  { id: 'streak_7', icon: '🌟', name: 'Week Warrior', description: '7-day logging streak', check: (s: Stats) => s.streak >= 7 },
  { id: 'streak_30', icon: '👑', name: 'Monthly Master', description: '30-day logging streak', check: (s: Stats) => s.streak >= 30 },
  { id: 'week_active', icon: '📅', name: 'First Week', description: 'Active for 7 days', check: (s: Stats) => s.daysActive >= 7 },
  { id: 'month_active', icon: '🗓️', name: 'One Month', description: 'Active for 30 days', check: (s: Stats) => s.daysActive >= 30 },
];

export const getAchievements = async (): Promise<Achievement[]> => {
  const [profileStats, streak] = await Promise.all([
    getProfileStats(),
    getLoggingStreak(),
  ]);

  const stats: Stats = {
    totalMeals: profileStats.totalMeals,
    daysActive: profileStats.daysActive,
    streak,
  };

  return ACHIEVEMENT_DEFS.map(def => ({
    id: def.id,
    icon: def.icon,
    name: def.name,
    description: def.description,
    earned: def.check(stats),
  }));
};
