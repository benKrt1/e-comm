import type { Metadata } from 'next';
import CartClient from './CartClient';

export const metadata: Metadata = { title: 'Your cart' };

// The cart is client state (guest carts live in localStorage), so the page
// is a thin server shell around the client component.
export default function CartPage() {
  return <CartClient />;
}
