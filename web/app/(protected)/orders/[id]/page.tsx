import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { getOrderById } from '@/lib/data/orders';
import { formatPrice } from '@/lib/format';
import OrderItemImage from './OrderItemImage';
import styles from './OrderPage.module.css';

export const metadata: Metadata = { title: 'Order details' };

const STATUS_LABELS: Record<string, string> = {
  pending: 'Being prepared',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const order = await getOrderById(id, user._id.toString(), user.role === 'admin');
  if (!order) notFound();

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
            {/* key: product id is unique per order line — the cart dedupes by product */}
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
