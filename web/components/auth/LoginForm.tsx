'use client';

import { useEffect, useState, type ChangeEvent, type SubmitEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/providers/ToastProvider';
import { getErrorMessage } from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import styles from './AuthPage.module.css';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function LoginForm() {
  const { login, status } = useAuth();
  const addToast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only same-site paths are valid post-login destinations (no open redirects).
  const redirectParam = searchParams.get('redirect');
  const target = redirectParam?.startsWith('/') ? redirectParam : '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Already (or just now) logged in → go where the user came from.
  useEffect(() => {
    if (status === 'authenticated') router.replace(target);
  }, [status, router, target]);

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

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const { message } = await login(form.email, form.password);
      addToast(message);
      // The effect above redirects once status flips to authenticated.
    } catch (err) {
      setFormError(getErrorMessage(err));
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
