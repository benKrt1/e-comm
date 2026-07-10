'use client';

import { useState, type ChangeEvent, type SubmitEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/providers/ToastProvider';
import { registerAction } from '@/actions/auth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import styles from './AuthPage.module.css';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function RegisterForm() {
  const addToast = useToast();
  const router = useRouter();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFieldErrors({ ...fieldErrors, [e.target.name]: '' });
  };

  // Mirrors the server-side rules so most mistakes are caught before a round-trip.
  const validate = () => {
    const errors: Record<string, string> = {};
    const name = form.name.trim();
    if (name.length < 2 || name.length > 50) errors.name = 'Name must be 2–50 characters';
    if (!EMAIL_RE.test(form.email)) errors.email = 'Enter a valid email address';
    if (form.password.length < 8) errors.password = 'Password must be at least 8 characters';
    if (form.confirm !== form.password) errors.confirm = 'Passwords do not match';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;

    setSubmitting(true);
    const result = await registerAction({
      name: form.name.trim(),
      email: form.email,
      password: form.password,
    });
    if (result.success) {
      addToast(result.message);
      router.push('/');
      // Re-render server components (Navbar) with the new session.
      router.refresh();
    } else {
      setFormError(result.message);
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <section className={styles.card} aria-labelledby="register-title">
        <h1 id="register-title" className={styles.title}>
          Create account
        </h1>
        <p className={styles.subtitle}>Join NordCart — it takes half a minute</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {formError && (
            <p className={styles.formError} role="alert">
              {formError}
            </p>
          )}
          <Input
            id="reg-name"
            name="name"
            label="Full name"
            autoComplete="name"
            value={form.name}
            onChange={handleChange}
            error={fieldErrors.name}
          />
          <Input
            id="reg-email"
            name="email"
            type="email"
            label="Email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            error={fieldErrors.email}
          />
          <Input
            id="reg-password"
            name="password"
            type="password"
            label="Password (min. 8 characters)"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            error={fieldErrors.password}
          />
          <Input
            id="reg-confirm"
            name="confirm"
            type="password"
            label="Confirm password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={handleChange}
            error={fieldErrors.confirm}
          />
          <Button type="submit" isLoading={submitting}>
            Create account
          </Button>
        </form>

        <p className={styles.switch}>
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </section>
    </div>
  );
}
