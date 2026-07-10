import { redirect } from 'next/navigation';
import { requireAdmin, SessionError } from '@/lib/session';

/**
 * Staff-only guard. The proxy already blocks non-admins optimistically from
 * the token role; this re-checks against the live DB (role changes and
 * deletions take effect immediately) — defense in depth.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof SessionError) redirect('/');
    throw err;
  }
  return <>{children}</>;
}
