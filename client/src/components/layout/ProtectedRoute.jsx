import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../ui/Spinner';

/**
 * Route guard for logged-in areas. While the session restore is in
 * flight we show a spinner instead of redirecting — otherwise a hard
 * refresh on /profile would bounce a logged-in user to /login.
 *
 * routesLocation is the location this Routes tree was rendered for.
 * AnimatePresence (mode="wait") keeps the *previous* page mounted while
 * it animates out; if the user logs out, that exiting snapshot would
 * see status become 'guest' and hijack navigation with its redirect.
 * Comparing routesLocation against the live location detects the
 * exiting copy so only the active tree may redirect.
 */
export default function ProtectedRoute({ routesLocation }) {
  const { status } = useAuth();
  const liveLocation = useLocation();
  const isExitingSnapshot = routesLocation.pathname !== liveLocation.pathname;

  if (status === 'loading') return <Spinner fullPage />;
  if (status === 'guest') {
    // Exiting snapshot: render nothing — the page is mid-fade-out and the
    // user object its children rely on is already gone.
    if (isExitingSnapshot) return null;
    return <Navigate to="/login" replace state={{ from: routesLocation.pathname }} />;
  }
  return <Outlet />;
}
