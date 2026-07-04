import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/axios';
import { formatPrice } from '../../utils/format';
import Spinner from '../../components/ui/Spinner';
import styles from './AdminDashboardPage.module.css';

const STATUS_LABELS = { pending: 'Pending', shipped: 'Shipped', delivered: 'Delivered' };

export default function AdminDashboardPage() {
  const [state, setState] = useState({ stats: null, error: null });

  useEffect(() => {
    let cancelled = false;
    api
      .get('/admin/stats')
      .then(({ data }) => !cancelled && setState({ stats: data.data, error: null }))
      .catch((err) => !cancelled && setState({ stats: null, error: getErrorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, []);

  const { stats, error } = state;

  if (error) {
    return (
      <main className={`${styles.page} ${styles.error}`}>
        <h1>{error}</h1>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className={styles.page} aria-busy="true">
        <Spinner fullPage />
      </main>
    );
  }

  const tiles = [
    { label: 'Revenue', value: formatPrice(stats.revenue) },
    { label: 'Orders', value: stats.orderCount },
    { label: 'Products', value: stats.productCount },
    { label: 'Users', value: stats.userCount },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Admin</h1>
        <nav className={styles.nav} aria-label="Admin sections">
          <Link to="/admin/products">Products</Link>
          <Link to="/admin/orders">Orders</Link>
        </nav>
      </header>

      <section aria-label="Store totals" className={styles.tiles}>
        {tiles.map((tile) => (
          <div key={tile.label} className={styles.tile}>
            <p className={styles.tileValue}>{tile.value}</p>
            <p className={styles.tileLabel}>{tile.label}</p>
          </div>
        ))}
      </section>

      <div className={styles.columns}>
        <section aria-labelledby="low-stock-heading">
          <h2 id="low-stock-heading">Low stock</h2>
          {stats.lowStock.length === 0 ? (
            <p className={styles.emptyNote}>Everything is well stocked.</p>
          ) : (
            <ul className={styles.list}>
              {stats.lowStock.map((product) => (
                <li key={product._id} className={styles.listRow}>
                  <Link to={`/products/${product.slug}`}>{product.name}</Link>
                  <span className={product.countInStock === 0 ? styles.out : styles.low}>
                    {product.countInStock === 0 ? 'Out of stock' : `${product.countInStock} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="recent-orders-heading">
          <h2 id="recent-orders-heading">Recent orders</h2>
          {stats.recentOrders.length === 0 ? (
            <p className={styles.emptyNote}>No orders yet.</p>
          ) : (
            <ul className={styles.list}>
              {stats.recentOrders.map((order) => (
                <li key={order._id} className={styles.listRow}>
                  <span>
                    {order.user?.name ?? 'Deleted user'} ·{' '}
                    <time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleDateString('sv-SE')}</time>
                  </span>
                  <span>
                    {STATUS_LABELS[order.status]} · <strong>{formatPrice(order.totalPrice)}</strong>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
