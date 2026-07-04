import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../ui/Spinner';

/**
 * Route guard for staff-only pages: ProtectedRoute's logic plus a role
 * check. Non-admins get bounced home (they have no business knowing the
 * admin routes exist). See ProtectedRoute for the exiting-snapshot dance.
 */
export default function AdminRoute({ routesLocation }) {
  const { user, status } = useAuth();
  const liveLocation = useLocation();
  const isExitingSnapshot = routesLocation.pathname !== liveLocation.pathname;

  if (status === 'loading') return <Spinner fullPage />;
  if (status === 'guest') {
    if (isExitingSnapshot) return null;
    return <Navigate to="/login" replace state={{ from: routesLocation.pathname }} />;
  }
  if (user.role !== 'admin') {
    if (isExitingSnapshot) return null;
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
