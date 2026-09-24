import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

/** Only authenticated coaches may enter /coach/*. */
export function RequireCoach({ children }) {
  const { isAuthenticated, user, expired } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/coach/login" replace state={{ from: location.pathname + location.search, expired }} />;
  }
  if (user?.role !== 'coach') return <Navigate to="/coach/unauthorized" replace />;
  return children;
}

/** Signed-in coaches skip the login page. */
export function GuestOnly({ children }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/coach/dashboard" replace />;
  return children;
}
