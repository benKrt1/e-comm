'use client';

import { useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/providers/ToastProvider';
import { updateOrderStatusAction } from '@/actions/admin';
import styles from './AdminOrdersPage.module.css';

const STATUSES = ['pending', 'shipped', 'delivered'];

export default function AdminOrderStatus({
  orderId,
  status,
  label,
}: {
  orderId: string;
  status: string;
  label: string;
}) {
  const router = useRouter();
  const addToast = useToast();
  const [current, setCurrent] = useState(status);
  const [saving, setSaving] = useState(false);

  const handleChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    const previous = current;
    setCurrent(next);
    setSaving(true);
    const result = await updateOrderStatusAction(orderId, next);
    setSaving(false);
    if (result.success) {
      addToast(result.message);
      router.refresh();
    } else {
      setCurrent(previous); // roll back the optimistic select
      addToast(result.message, 'error');
    }
  };

  return (
    <select className={styles.status} value={current} onChange={handleChange} disabled={saving} aria-label={label}>
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
