import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import LoginForm from '@/components/auth/LoginForm';

export const metadata: Metadata = { title: 'Log in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  // Only allow same-site paths as the post-login destination (no open redirects).
  const target = params.redirect?.startsWith('/') ? params.redirect : '/';

  // Already logged in → go back where the user came from.
  const session = await auth();
  if (session?.user) redirect(target);

  return <LoginForm redirectTo={target} />;
}
