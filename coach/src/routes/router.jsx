import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { PageSkeleton } from '@/components/ui/Skeleton';
import CoachLayout from '@/layouts/CoachLayout';
import { GuestOnly, RequireCoach } from './guards';

// Route-level code splitting: each page is its own chunk.
const Login = lazy(() => import('@/pages/auth/LoginPage'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const Dashboard = lazy(() => import('@/pages/dashboard/DashboardPage'));
const Teams = lazy(() => import('@/pages/teams/TeamsPage'));
const TeamDetail = lazy(() => import('@/pages/teams/TeamDetailPage'));
const Players = lazy(() => import('@/pages/players/PlayersPage'));
const PlayerDetail = lazy(() => import('@/pages/players/PlayerDetailPage'));
const Training = lazy(() => import('@/pages/training/TrainingPage'));
const TrainingDetail = lazy(() => import('@/pages/training/TrainingDetailPage'));
const Attendance = lazy(() => import('@/pages/attendance/AttendancePage'));
const Matches = lazy(() => import('@/pages/matches/MatchesPage'));
const MatchDetail = lazy(() => import('@/pages/matches/MatchDetailPage'));
const Competitions = lazy(() => import('@/pages/competitions/CompetitionsPage'));
const CompetitionDetail = lazy(() => import('@/pages/competitions/CompetitionDetailPage'));
const Statistics = lazy(() => import('@/pages/statistics/StatisticsPage'));
const Calendar = lazy(() => import('@/pages/calendar/CalendarPage'));
const Notifications = lazy(() => import('@/pages/notifications/NotificationsPage'));
const Profile = lazy(() => import('@/pages/profile/ProfilePage'));
const Settings = lazy(() => import('@/pages/settings/SettingsPage'));
const NotFound = lazy(() => import('@/pages/errors/NotFoundPage'));
const Unauthorized = lazy(() => import('@/pages/errors/UnauthorizedPage'));

function Root() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <PageSkeleton />
        </div>
      }
    >
      <Outlet />
    </Suspense>
  );
}

const guest = (el) => <GuestOnly>{el}</GuestOnly>;

/** Data router — required for useBlocker (unsaved-changes prompts). */
export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <Navigate to="/coach/dashboard" replace /> },
      { path: '/coach/login', element: guest(<Login />) },
      { path: '/coach/forgot-password', element: guest(<ForgotPassword />) },
      { path: '/coach/unauthorized', element: <Unauthorized /> },
      {
        path: '/coach',
        element: (
          <RequireCoach>
            <CoachLayout />
          </RequireCoach>
        ),
        children: [
          { index: true, element: <Navigate to="/coach/dashboard" replace /> },
          { path: 'dashboard', element: <Dashboard /> },
          { path: 'teams', element: <Teams /> },
          { path: 'teams/:id', element: <TeamDetail /> },
          { path: 'players', element: <Players /> },
          { path: 'players/:id', element: <PlayerDetail /> },
          { path: 'training', element: <Training /> },
          { path: 'training/:id', element: <TrainingDetail /> },
          { path: 'attendance', element: <Attendance /> },
          { path: 'matches', element: <Matches /> },
          { path: 'matches/:id', element: <MatchDetail /> },
          { path: 'competitions', element: <Competitions /> },
          { path: 'competitions/:id', element: <CompetitionDetail /> },
          { path: 'statistics', element: <Statistics /> },
          { path: 'calendar', element: <Calendar /> },
          { path: 'notifications', element: <Notifications /> },
          { path: 'profile', element: <Profile /> },
          { path: 'settings', element: <Settings /> },
          { path: '*', element: <NotFound inLayout /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
