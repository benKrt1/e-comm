'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Spinner from '@/components/ui/Spinner';

/**
 * Guard for staff-only pages: ProtectedRoute's logic plus a role check.
 * Non-admins get bounced home (they have no business knowing the admin
 * routes exist). The server re-enforces admin on every /admin API call.
 */
export default function AdminRoute({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'guest') {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else if (status === 'authenticated' && user?.role !== 'admin') {
      router.replace('/');
    }
  }, [status, user, router, pathname]);

  if (status !== 'authenticated' || user?.role !== 'admin') return <Spinner fullPage />;
  return <>{children}</>;
}
