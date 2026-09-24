import { BarChart3, Bell, CalendarCheck, CalendarDays, Dumbbell, Goal, LayoutDashboard, Settings, Shield, Trophy, UserRound } from 'lucide-react';

/** Sidebar structure (spec order). `key` maps to nav.<key> in the translation files. */
export const NAV_GROUPS = [
  { key: 'overview', items: [{ key: 'dashboard', to: '/player/dashboard', icon: LayoutDashboard }] },
  {
    key: 'me',
    items: [
      { key: 'profile', to: '/player/profile', icon: UserRound },
      { key: 'team', to: '/player/team', icon: Shield },
    ],
  },
  {
    key: 'season',
    items: [
      { key: 'matches', to: '/player/matches', icon: Goal },
      { key: 'training', to: '/player/training', icon: Dumbbell },
      { key: 'attendance', to: '/player/attendance', icon: CalendarCheck },
      { key: 'statistics', to: '/player/statistics', icon: BarChart3 },
      { key: 'competitions', to: '/player/competitions', icon: Trophy },
    ],
  },
  {
    key: 'planning',
    items: [
      { key: 'calendar', to: '/player/calendar', icon: CalendarDays },
      { key: 'notifications', to: '/player/notifications', icon: Bell, badge: 'unread' },
    ],
  },
  { key: 'account', items: [{ key: 'settings', to: '/player/settings', icon: Settings }] },
];

/** Bottom bar on phones — the four most-used destinations plus "More" (opens the drawer). */
export const MOBILE_TABS = ['dashboard', 'matches', 'training', 'statistics'];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
