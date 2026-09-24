import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageSkeleton } from '@/components/ui/Skeleton';
import AdminLayout from '@/layouts/AdminLayout';
import { GuestOnly, RequireAdmin } from './guards';

// Route-level code splitting: each page is its own chunk.
const Login = lazy(() => import('@/pages/auth/LoginPage'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const Dashboard = lazy(() => import('@/pages/dashboard/DashboardPage'));
const Users = lazy(() => import('@/pages/users/UsersPage'));
const Players = lazy(() => import('@/pages/players/PlayersPage'));
const PlayerDetail = lazy(() => import('@/pages/players/PlayerDetailPage'));
const Coaches = lazy(() => import('@/pages/coaches/CoachesPage'));
const CoachDetail = lazy(() => import('@/pages/coaches/CoachDetailPage'));
const Teams = lazy(() => import('@/pages/teams/TeamsPage'));
const TeamDetail = lazy(() => import('@/pages/teams/TeamDetailPage'));
const Competitions = lazy(() => import('@/pages/competitions/CompetitionsPage'));
const CompetitionDetail = lazy(() => import('@/pages/competitions/CompetitionDetailPage'));
const Matches = lazy(() => import('@/pages/matches/MatchesPage'));
const MatchDetail = lazy(() => import('@/pages/matches/MatchDetailPage'));
const Training = lazy(() => import('@/pages/training/TrainingPage'));
const TrainingDetail = lazy(() => import('@/pages/training/TrainingDetailPage'));
const Attendance = lazy(() => import('@/pages/attendance/AttendancePage'));
const Statistics = lazy(() => import('@/pages/statistics/StatisticsPage'));
const Reports = lazy(() => import('@/pages/reports/ReportsPage'));
const Notifications = lazy(() => import('@/pages/notifications/NotificationsPage'));
const Settings = lazy(() => import('@/pages/settings/SettingsPage'));
const NotFound = lazy(() => import('@/pages/errors/NotFoundPage'));
const Unauthorized = lazy(() => import('@/pages/errors/UnauthorizedPage'));

export default function AppRoutes() {
  return (
    <Suspense fallback={<div className="p-6"><PageSkeleton /></div>}>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/admin/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
        <Route path="/admin/unauthorized" element={<Unauthorized />} />

        <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="players" element={<Players />} />
          <Route path="players/:id" element={<PlayerDetail />} />
          <Route path="coaches" element={<Coaches />} />
          <Route path="coaches/:id" element={<CoachDetail />} />
          <Route path="teams" element={<Teams />} />
          <Route path="teams/:id" element={<TeamDetail />} />
          <Route path="competitions" element={<Competitions />} />
          <Route path="competitions/:id" element={<CompetitionDetail />} />
          <Route path="matches" element={<Matches />} />
          <Route path="matches/:id" element={<MatchDetail />} />
          <Route path="training" element={<Training />} />
          <Route path="training/:id" element={<TrainingDetail />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="reports" element={<Reports />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound inLayout />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
