import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoginForm from '@/components/auth/LoginForm';

export const metadata: Metadata = { title: 'Log in' };

export default function LoginPage() {
  // Suspense boundary: LoginForm reads the ?redirect search param.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
