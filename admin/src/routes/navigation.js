import {
  BarChart3,
  Bell,
  CalendarCheck,
  ClipboardList,
  Dumbbell,
  FileBarChart,
  Goal,
  LayoutDashboard,
  Settings,
  Shield,
  Shirt,
  Trophy,
  UserCog,
} from 'lucide-react';

/** Sidebar structure. `key` maps to nav.<key> in the translation files. */
export const NAV_GROUPS = [
  {
    key: 'overview',
    items: [{ key: 'dashboard', to: '/admin/dashboard', icon: LayoutDashboard }],
  },
  {
    key: 'people',
    items: [
      { key: 'users', to: '/admin/users', icon: UserCog },
      { key: 'players', to: '/admin/players', icon: Shirt },
      { key: 'coaches', to: '/admin/coaches', icon: ClipboardList },
      { key: 'teams', to: '/admin/teams', icon: Shield },
    ],
  },
  {
    key: 'competition',
    items: [
      { key: 'competitions', to: '/admin/competitions', icon: Trophy },
      { key: 'matches', to: '/admin/matches', icon: Goal },
      { key: 'training', to: '/admin/training', icon: Dumbbell },
      { key: 'attendance', to: '/admin/attendance', icon: CalendarCheck },
    ],
  },
  {
    key: 'insights',
    items: [
      { key: 'statistics', to: '/admin/statistics', icon: BarChart3 },
      { key: 'reports', to: '/admin/reports', icon: FileBarChart },
      { key: 'notifications', to: '/admin/notifications', icon: Bell, badge: 'unread' },
    ],
  },
  {
    key: 'system',
    items: [{ key: 'settings', to: '/admin/settings', icon: Settings }],
  },
];

/** Bottom bar on phones — the four most-used destinations plus "More" (opens the drawer). */
export const MOBILE_TABS = ['dashboard', 'players', 'matches', 'training'];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
