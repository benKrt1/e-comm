import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllOrders } from '@/lib/data/admin';
import { formatPrice } from '@/lib/format';
import AdminOrderStatus from '@/components/admin/AdminOrderStatus';
import styles from '@/components/admin/AdminOrdersPage.module.css';

export const metadata: Metadata = { title: 'Orders · Admin' };

export default async function AdminOrdersPage() {
  const orders = await getAllOrders();

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
                        {order.userName ?? 'Deleted user'}
                        <span className={styles.email}>{order.userEmail}</span>
                      </span>
                    </td>
                    <td className={styles.num}>{order.itemCount}</td>
                    <td className={styles.num}>{formatPrice(order.totalPrice)}</td>
                    <td>{order.isPaid ? '✓' : '—'}</td>
                    <td>
                      <AdminOrderStatus
                        orderId={order._id}
                        status={order.status}
                        label={`Status of order placed ${placed} by ${order.userName ?? 'deleted user'}`}
                      />
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
