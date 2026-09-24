import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

/** Only authenticated Super Admins may enter /admin/*. */
export function RequireAdmin({ children }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (user?.role !== 'super_admin') return <Navigate to="/admin/unauthorized" replace />;
  return children;
}

/** Signed-in admins skip the login page. */
export function GuestOnly({ children }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/admin/dashboard" replace />;
  return children;
}
