'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/providers/ToastProvider';
import { deleteProductAction } from '@/actions/admin';
import { formatPrice } from '@/lib/format';
import type { SerializedProduct } from '@/types';
import styles from './AdminProductsPage.module.css';

const PLACEHOLDER = '/placeholder-product.svg';

export default function AdminProductsTable({ products }: { products: SerializedProduct[] }) {
  const router = useRouter();
  const addToast = useToast();
  // Two-click delete: first click arms the row, second click commits.
  // (No window.confirm — blocking dialogs are hostile to users and tests.)
  const [armedId, setArmedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (product: SerializedProduct) => {
    if (armedId !== product._id) {
      setArmedId(product._id);
      return;
    }
    setDeletingId(product._id);
    const result = await deleteProductAction(product._id);
    setDeletingId(null);
    setArmedId(null);
    if (result.success) {
      addToast(result.message);
      router.refresh();
    } else {
      addToast(result.message, 'error');
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>
          Products <span>({products.length})</span>
        </h1>
        <Link href="/admin/products/new" className={styles.newButton}>
          + New product
        </Link>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">Category</th>
              <th scope="col">Price</th>
              <th scope="col">Stock</th>
              <th scope="col">Featured</th>
              <th scope="col">
                <span className={styles.srOnly}>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <ProductRow
                key={product._id}
                product={product}
                armed={armedId === product._id}
                deleting={deletingId === product._id}
                onDelete={() => handleDelete(product)}
                onBlur={() => setArmedId((id) => (id === product._id ? null : id))}
              />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function ProductRow({
  product,
  armed,
  deleting,
  onDelete,
  onBlur,
}: {
  product: SerializedProduct;
  armed: boolean;
  deleting: boolean;
  onDelete: () => void;
  onBlur: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <tr>
      <td>
        <div className={styles.productCell}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgFailed ? PLACEHOLDER : (product.images[0]?.url ?? PLACEHOLDER)}
            alt=""
            onError={() => setImgFailed(true)}
          />
          <span>{product.name}</span>
        </div>
      </td>
      <td>{product.category}</td>
      <td className={styles.num}>{formatPrice(product.price)}</td>
      <td className={`${styles.num} ${product.countInStock <= 5 ? styles.low : ''}`.trim()}>
        {product.countInStock}
      </td>
      <td>{product.isFeatured ? '★' : ''}</td>
      <td>
        <div className={styles.actions}>
          <Link href={`/admin/products/${product._id}/edit`} className={styles.edit}>
            Edit
          </Link>
          <button
            className={armed ? styles.confirmDelete : styles.delete}
            onClick={onDelete}
            onBlur={onBlur}
            disabled={deleting}
          >
            {armed ? 'Confirm?' : 'Delete'}
          </button>
        </div>
      </td>
    </tr>
  );
}
