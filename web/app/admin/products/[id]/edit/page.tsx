'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api, { getErrorMessage } from '@/lib/api';
import { useToast } from '@/components/providers/ToastProvider';
import AdminProductForm from '@/components/admin/AdminProductForm';
import Spinner from '@/components/ui/Spinner';
import type { SerializedProduct } from '@/types';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const addToast = useToast();
  const [product, setProduct] = useState<SerializedProduct | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/admin/products/${id}`)
      .then(({ data }) => !cancelled && setProduct(data.data.product))
      .catch((err) => {
        if (cancelled) return;
        addToast(getErrorMessage(err), 'error');
        router.replace('/admin/products');
      });
    return () => {
      cancelled = true;
    };
  }, [id, addToast, router]);

  if (!product) return <Spinner fullPage />;
  return <AdminProductForm product={product} />;
}
