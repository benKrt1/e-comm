import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import RegisterForm from '@/components/auth/RegisterForm';

export const metadata: Metadata = { title: 'Create account' };

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect('/');

  return <RegisterForm />;
}
