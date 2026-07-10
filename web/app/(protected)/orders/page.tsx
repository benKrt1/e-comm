import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { getMyOrders } from '@/lib/data/orders';
import { formatPrice } from '@/lib/format';
import styles from './OrdersPage.module.css';

export const metadata: Metadata = { title: 'Your orders' };

const STATUS_LABELS: Record<string, string> = {
  pending: 'Being prepared',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await getMyOrders(user._id.toString());

  if (orders.length === 0) {
    return (
      <main className={`${styles.page} ${styles.empty}`}>
        <h1>No orders yet</h1>
        <p>When you place an order it will show up here.</p>
        <Link href="/products" className={styles.browse}>
          Browse products
        </Link>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Your orders</h1>
      <ul className={styles.list}>
        {orders.map((order) => {
          const itemCount = order.orderItems.reduce((sum, item) => sum + item.quantity, 0);
          return (
            <li key={order._id}>
              <Link href={`/orders/${order._id}`} className={styles.card}>
                <div>
                  <p className={styles.date}>{new Date(order.createdAt).toLocaleDateString('sv-SE')}</p>
                  <p className={styles.summaryLine}>
                    {itemCount} {itemCount === 1 ? 'item' : 'items'} · {STATUS_LABELS[order.status]}
                  </p>
                </div>
                <p className={styles.total}>{formatPrice(order.totalPrice)}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
