import type { Metadata } from 'next';
import Link from 'next/link';
import { getAdminStats } from '@/lib/data/admin';
import { formatPrice } from '@/lib/format';
import styles from '@/components/admin/AdminDashboardPage.module.css';

export const metadata: Metadata = { title: 'Admin' };

const STATUS_LABELS: Record<string, string> = { pending: 'Pending', shipped: 'Shipped', delivered: 'Delivered' };

export default async function AdminDashboardPage() {
  const stats = await getAdminStats();

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
          <Link href="/admin/products">Products</Link>
          <Link href="/admin/orders">Orders</Link>
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
                  <Link href={`/products/${product.slug}`}>{product.name}</Link>
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
                    {order.userName ?? 'Deleted user'} ·{' '}
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
