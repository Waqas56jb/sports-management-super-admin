import {
  BarChart3,
  Bell,
  CalendarCheck,
  CalendarDays,
  Dumbbell,
  Goal,
  LayoutDashboard,
  Settings,
  Shield,
  Shirt,
  Trophy,
  UserRound,
} from 'lucide-react';

/** Sidebar structure. `key` maps to nav.<key> in the translation files. */
export const NAV_GROUPS = [
  {
    key: 'overview',
    items: [{ key: 'dashboard', to: '/coach/dashboard', icon: LayoutDashboard }],
  },
  {
    key: 'squad',
    items: [
      { key: 'teams', to: '/coach/teams', icon: Shield },
      { key: 'players', to: '/coach/players', icon: Shirt },
    ],
  },
  {
    key: 'coaching',
    items: [
      { key: 'training', to: '/coach/training', icon: Dumbbell },
      { key: 'attendance', to: '/coach/attendance', icon: CalendarCheck },
      { key: 'matches', to: '/coach/matches', icon: Goal },
      { key: 'competitions', to: '/coach/competitions', icon: Trophy },
    ],
  },
  {
    key: 'insights',
    items: [
      { key: 'statistics', to: '/coach/statistics', icon: BarChart3 },
      { key: 'calendar', to: '/coach/calendar', icon: CalendarDays },
      { key: 'notifications', to: '/coach/notifications', icon: Bell, badge: 'unread' },
    ],
  },
  {
    key: 'account',
    items: [
      { key: 'profile', to: '/coach/profile', icon: UserRound },
      { key: 'settings', to: '/coach/settings', icon: Settings },
    ],
  },
];

/** Bottom bar on phones — the four most-used coaching destinations plus "More" (opens the drawer). */
export const MOBILE_TABS = ['dashboard', 'training', 'attendance', 'matches'];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
