import type { Metadata } from 'next';
import WishlistClient from './WishlistClient';

export const metadata: Metadata = { title: 'Wishlist' };

// The wishlist is client state (WishlistProvider), so the page is a thin
// server shell — the guard layout already ensures the user is logged in.
export default function WishlistPage() {
  return <WishlistClient />;
}
