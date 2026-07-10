import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAdminProductById } from '@/lib/data/admin';
import AdminProductForm from '@/components/admin/AdminProductForm';

export const metadata: Metadata = { title: 'Edit product · Admin' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getAdminProductById(id);
  if (!product) notFound();

  return <AdminProductForm product={product} />;
}
