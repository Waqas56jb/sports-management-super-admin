import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

/** Only authenticated players may enter /player/*. */
export function RequirePlayer({ children }) {
  const { isAuthenticated, user, expired } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/player/login" replace state={{ from: location.pathname + location.search, expired }} />;
  }
  if (user?.role !== 'player') return <Navigate to="/player/unauthorized" replace />;
  return children;
}

/** Signed-in players skip the login page. */
export function GuestOnly({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  // After sign-in, return to the page that sent the player to the login screen.
  if (isAuthenticated) return <Navigate to={location.state?.from ?? '/player/dashboard'} replace />;
  return children;
}
