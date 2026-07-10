'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import api, { getErrorMessage } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import Spinner from '@/components/ui/Spinner';
import OrderItemImage from './OrderItemImage';
import type { SerializedOrder } from '@/types';
import styles from './OrderPage.module.css';

const STATUS_LABELS: Record<string, string> = { pending: 'Being prepared', shipped: 'Shipped', delivered: 'Delivered' };

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<{ order: SerializedOrder | null; loading: boolean; error: string | null }>({
    order: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/orders/${id}`)
      .then(({ data }) => !cancelled && setState({ order: data.data.order, loading: false, error: null }))
      .catch((err) => !cancelled && setState({ order: null, loading: false, error: getErrorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const { order, loading, error } = state;

  if (loading) {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner fullPage />
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className={`${styles.page} ${styles.error}`}>
        <h1>{error ?? 'Order not found'}</h1>
        <Link href="/orders" className={styles.backLink}>
          ← Your orders
        </Link>
      </main>
    );
  }

  const placed = new Date(order.createdAt).toLocaleDateString('sv-SE');

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Thanks for your order!</h1>
        <p className={styles.meta}>
          Order <span className={styles.orderId}>{order._id}</span> · placed {placed}
        </p>
        <div className={styles.badges}>
          {order.isPaid && <span className={`${styles.badge} ${styles.paid}`}>Paid</span>}
          <span className={styles.badge}>{STATUS_LABELS[order.status]}</span>
        </div>
      </header>

      <div className={styles.layout}>
        <section aria-labelledby="items-heading">
          <h2 id="items-heading">Items</h2>
          <ul className={styles.items}>
            {order.orderItems.map((item) => (
              <li key={item.product} className={styles.item}>
                <OrderItemImage src={item.image} />
                <div className={styles.itemInfo}>
                  <p className={styles.itemName}>{item.name}</p>
                  <p className={styles.itemQty}>
                    {item.quantity} × {formatPrice(item.price)}
                  </p>
                </div>
                <p className={styles.itemTotal}>{formatPrice(item.price * item.quantity)}</p>
              </li>
            ))}
          </ul>
        </section>

        <aside className={styles.details}>
          <section aria-labelledby="address-heading">
            <h2 id="address-heading">Shipping to</h2>
            <address className={styles.address}>
              {order.shippingAddress.fullName}
              <br />
              {order.shippingAddress.street}
              <br />
              {order.shippingAddress.postalCode} {order.shippingAddress.city}
              <br />
              {order.shippingAddress.country}
            </address>
          </section>

          <section aria-labelledby="summary-heading">
            <h2 id="summary-heading">Summary</h2>
            <dl className={styles.summary}>
              <div>
                <dt>Items</dt>
                <dd>{formatPrice(order.itemsPrice)}</dd>
              </div>
              <div>
                <dt>Shipping</dt>
                <dd>{order.shippingPrice === 0 ? 'Free' : formatPrice(order.shippingPrice)}</dd>
              </div>
              <div>
                <dt>Incl. 25% VAT</dt>
                <dd>{formatPrice(order.taxPrice)}</dd>
              </div>
              <div className={styles.total}>
                <dt>Total</dt>
                <dd>{formatPrice(order.totalPrice)}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}
