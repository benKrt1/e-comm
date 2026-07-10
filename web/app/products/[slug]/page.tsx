'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import api, { getErrorMessage } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import Rating from '@/components/ui/Rating';
import Skeleton from '@/components/ui/Skeleton';
import ProductGrid from '@/components/products/ProductGrid';
import ProductGallery from '@/components/products/ProductGallery';
import ProductActions from '@/components/products/ProductActions';
import ReviewsSection from '@/components/reviews/ReviewsSection';
import type { SerializedProduct } from '@/types';
import styles from './ProductPage.module.css';

interface ProductData {
  product: SerializedProduct | null;
  related: SerializedProduct[];
  loading: boolean;
  error: string | null;
}

export default function ProductPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [data, setData] = useState<ProductData>({ product: null, related: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setData({ product: null, related: [], loading: true, error: null });
    window.scrollTo(0, 0); // related-product clicks land mid-scroll otherwise
    api
      .get(`/products/${slug}`)
      .then(({ data: res }) => !cancelled && setData({ ...res.data, loading: false, error: null }))
      .catch(
        (err) => !cancelled && setData({ product: null, related: [], loading: false, error: getErrorMessage(err) })
      );
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const { product, related, loading, error } = data;

  if (loading) {
    return (
      <main className={styles.page} aria-busy="true">
        <div className={styles.layout}>
          <Skeleton className={styles.gallerySkeleton} />
          <div className={styles.infoSkeleton}>
            <Skeleton style={{ width: '30%', height: 14 }} />
            <Skeleton style={{ width: '75%', height: 34 }} />
            <Skeleton style={{ width: '45%', height: 16 }} />
            <Skeleton style={{ width: '100%', height: 90 }} />
            <Skeleton style={{ width: '40%', height: 44 }} />
          </div>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className={`${styles.page} ${styles.error}`}>
        <h1>{error ?? 'Product not found'}</h1>
        <Link href="/products" className={styles.backLink}>
          ← Back to the shop
        </Link>
      </main>
    );
  }

  const outOfStock = product.countInStock === 0;
  const lowStock = product.countInStock > 0 && product.countInStock <= 5;

  return (
    <main className={styles.page}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link href="/products">Shop</Link> /{' '}
        <Link href={`/products?category=${product.category}`}>{product.category}</Link>
      </nav>

      <div className={styles.layout}>
        <ProductGallery product={product} />

        {/* --- Info column --- */}
        <section className={styles.info}>
          <p className={styles.brand}>{product.brand}</p>
          <h1 className={styles.name}>{product.name}</h1>
          <Rating value={product.rating} count={product.numReviews} />
          <p className={styles.price}>{formatPrice(product.price)}</p>
          <p className={styles.description}>{product.description}</p>

          <p className={styles.stock}>
            {outOfStock ? (
              <span className={styles.stockOut}>● Out of stock</span>
            ) : lowStock ? (
              <span className={styles.stockLow}>● Only {product.countInStock} left</span>
            ) : (
              <span className={styles.stockIn}>● In stock</span>
            )}
          </p>

          <ProductActions product={product} />
        </section>
      </div>

      <ReviewsSection productId={product._id} />

      {related.length > 0 && (
        <section className={styles.related} aria-labelledby="related-heading">
          <h2 id="related-heading">You might also like</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </main>
  );
}
