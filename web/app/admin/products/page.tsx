import type { Metadata } from 'next';
import { getAdminProducts } from '@/lib/data/admin';
import AdminProductsTable from '@/components/admin/AdminProductsTable';

export const metadata: Metadata = { title: 'Products · Admin' };

export default async function AdminProductsPage() {
  const products = await getAdminProducts();
  return <AdminProductsTable products={products} />;
}
