import { redirect } from 'next/navigation';
import { auth } from '@/auth';

/**
 * Guard layout for account pages. The proxy already redirects unauthenticated
 * requests before they reach here; this is defense in depth for the case
 * where the matcher and the tree ever drift apart.
 */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return <>{children}</>;
}
