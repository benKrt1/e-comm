'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import api, { getErrorMessage } from '@/lib/api';
import { useToast } from '@/components/providers/ToastProvider';
import { formatPrice } from '@/lib/format';
import Spinner from '@/components/ui/Spinner';
import styles from '@/components/admin/AdminOrdersPage.module.css';

const STATUSES = ['pending', 'shipped', 'delivered'];

interface AdminOrder {
  _id: string;
  orderItems: { quantity: number }[];
  totalPrice: number;
  isPaid: boolean;
  status: string;
  createdAt: string;
  user: { name: string; email: string } | null;
}

export default function AdminOrdersPage() {
  const addToast = useToast();
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/admin/orders')
      .then(({ data }) => !cancelled && setOrders(data.data.orders))
      .catch(() => !cancelled && setOrders([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStatusChange = (order: AdminOrder) => async (e: ChangeEvent<HTMLSelectElement>) => {
    const status = e.target.value;
    setSavingId(order._id);
    try {
      const { data } = await api.put(`/admin/orders/${order._id}/status`, { status });
      setOrders((current) =>
        (current ?? []).map((item) => (item._id === order._id ? { ...item, status: data.data.order.status } : item))
      );
      addToast(data.message);
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setSavingId(null);
    }
  };

  if (orders === null) {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner fullPage />
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>
          Orders <span>({orders.length})</span>
        </h1>
        <Link href="/admin" className={styles.backLink}>
          ← Dashboard
        </Link>
      </header>

      {orders.length === 0 ? (
        <p className={styles.emptyNote}>No orders yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Placed</th>
                <th scope="col">Customer</th>
                <th scope="col">Items</th>
                <th scope="col">Total</th>
                <th scope="col">Paid</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const itemCount = order.orderItems.reduce((sum, item) => sum + item.quantity, 0);
                const placed = new Date(order.createdAt).toLocaleDateString('sv-SE');
                return (
                  <tr key={order._id}>
                    <td>
                      {/* Admin can open the order detail: getOrderById allows admins */}
                      <Link href={`/orders/${order._id}`} className={styles.orderLink}>
                        {placed}
                      </Link>
                    </td>
                    <td>
                      <span className={styles.customer}>
                        {order.user?.name ?? 'Deleted user'}
                        <span className={styles.email}>{order.user?.email}</span>
                      </span>
                    </td>
                    <td className={styles.num}>{itemCount}</td>
                    <td className={styles.num}>{formatPrice(order.totalPrice)}</td>
                    <td>{order.isPaid ? '✓' : '—'}</td>
                    <td>
                      <select
                        className={styles.status}
                        value={order.status}
                        onChange={handleStatusChange(order)}
                        disabled={savingId === order._id}
                        aria-label={`Status of order placed ${placed} by ${order.user?.name ?? 'deleted user'}`}
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
