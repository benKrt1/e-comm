import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../api/axios';
import { formatPrice } from '../utils/format';
import Spinner from '../components/ui/Spinner';
import styles from './OrdersPage.module.css';

const STATUS_LABELS = { pending: 'Being prepared', shipped: 'Shipped', delivered: 'Delivered' };

export default function OrdersPage() {
  const [state, setState] = useState({ orders: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    api
      .get('/orders/mine')
      .then(({ data }) => !cancelled && setState({ orders: data.data.orders, loading: false, error: null }))
      .catch((err) => !cancelled && setState({ orders: [], loading: false, error: getErrorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, []);

  const { orders, loading, error } = state;

  if (loading) {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner fullPage />
      </main>
    );
  }

  if (error) {
    return (
      <main className={`${styles.page} ${styles.empty}`}>
        <h1>{error}</h1>
      </main>
    );
  }

  if (orders.length === 0) {
    return (
      <main className={`${styles.page} ${styles.empty}`}>
        <h1>No orders yet</h1>
        <p>When you place an order it will show up here.</p>
        <Link to="/products" className={styles.browse}>
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
              <Link to={`/orders/${order._id}`} className={styles.card}>
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
