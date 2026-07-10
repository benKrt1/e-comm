import type { Metadata } from 'next';
import AdminProductForm from '@/components/admin/AdminProductForm';

export const metadata: Metadata = { title: 'New product · Admin' };

export default function NewProductPage() {
  return <AdminProductForm />;
}
