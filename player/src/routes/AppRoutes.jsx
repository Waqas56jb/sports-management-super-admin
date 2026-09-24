import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { PageSkeleton } from '@/components/ui/Skeleton';
import PlayerLayout from '@/layouts/PlayerLayout';
import { GuestOnly, RequirePlayer } from './guards';

// Route-level code splitting: each page is its own chunk.
const Login = lazy(() => import('@/pages/auth/Login'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const MyProfile = lazy(() => import('@/pages/MyProfile'));
const MyTeam = lazy(() => import('@/pages/MyTeam'));
const Matches = lazy(() => import('@/pages/Matches'));
const MatchDetails = lazy(() => import('@/pages/MatchDetails'));
const Training = lazy(() => import('@/pages/Training'));
const TrainingDetails = lazy(() => import('@/pages/TrainingDetails'));
const Attendance = lazy(() => import('@/pages/Attendance'));
const Statistics = lazy(() => import('@/pages/Statistics'));
const Competitions = lazy(() => import('@/pages/Competitions'));
const CompetitionDetails = lazy(() => import('@/pages/CompetitionDetails'));
const Calendar = lazy(() => import('@/pages/Calendar'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const Settings = lazy(() => import('@/pages/Settings'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const Unauthorized = lazy(() => import('@/pages/Unauthorized'));

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

/** Data router (createBrowserRouter) so pages can use blockers and loaders later if needed. */
export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: '/', element: <Navigate to="/player/dashboard" replace /> },
      { path: '/player/login', element: guest(<Login />) },
      { path: '/player/forgot-password', element: guest(<ForgotPassword />) },
      { path: '/player/unauthorized', element: <Unauthorized /> },
      {
        path: '/player',
        element: (
          <RequirePlayer>
            <PlayerLayout />
          </RequirePlayer>
        ),
        children: [
          { index: true, element: <Navigate to="/player/dashboard" replace /> },
          { path: 'dashboard', element: <Dashboard /> },
          { path: 'profile', element: <MyProfile /> },
          { path: 'team', element: <MyTeam /> },
          { path: 'matches', element: <Matches /> },
          { path: 'matches/:id', element: <MatchDetails /> },
          { path: 'training', element: <Training /> },
          { path: 'training/:id', element: <TrainingDetails /> },
          { path: 'attendance', element: <Attendance /> },
          { path: 'statistics', element: <Statistics /> },
          { path: 'competitions', element: <Competitions /> },
          { path: 'competitions/:id', element: <CompetitionDetails /> },
          { path: 'calendar', element: <Calendar /> },
          { path: 'notifications', element: <Notifications /> },
          { path: 'settings', element: <Settings /> },
          { path: '*', element: <NotFound inLayout /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
