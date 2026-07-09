'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/providers/ToastProvider';
import { loginAction } from '@/actions/auth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import styles from './AuthPage.module.css';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function LoginForm({ redirectTo }: { redirectTo: string }) {
  const addToast = useToast();
  const router = useRouter();

  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFieldErrors({ ...fieldErrors, [e.target.name]: '' });
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!EMAIL_RE.test(form.email)) errors.email = 'Enter a valid email address';
    if (!form.password) errors.password = 'Password is required';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;

    setSubmitting(true);
    const result = await loginAction(form);
    if (result.success) {
      addToast(result.message);
      router.push(redirectTo);
      // Re-render server components (Navbar) with the new session.
      router.refresh();
    } else {
      setFormError(result.message);
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <section className={styles.card} aria-labelledby="login-title">
        <h1 id="login-title" className={styles.title}>
          Welcome back
        </h1>
        <p className={styles.subtitle}>Log in to your NordCart account</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {formError && (
            <p className={styles.formError} role="alert">
              {formError}
            </p>
          )}
          <Input
            id="login-email"
            name="email"
            type="email"
            label="Email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            error={fieldErrors.email}
          />
          <Input
            id="login-password"
            name="password"
            type="password"
            label="Password"
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            error={fieldErrors.password}
          />
          <Button type="submit" isLoading={submitting}>
            Log in
          </Button>
        </form>

        <p className={styles.switch}>
          New to NordCart? <Link href="/register">Create an account</Link>
        </p>
      </section>
    </div>
  );
}
