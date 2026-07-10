'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Spinner from '@/components/ui/Spinner';

/**
 * Guard for logged-in areas. While the session restore is in flight we show
 * a spinner instead of redirecting — otherwise a hard refresh on /profile
 * would bounce a logged-in user to /login. Guests are sent to /login with a
 * ?redirect back to where they were headed.
 */
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'guest') {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  if (status !== 'authenticated') return <Spinner fullPage />;
  return <>{children}</>;
}
