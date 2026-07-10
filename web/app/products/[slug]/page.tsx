import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { getProductBySlug } from '@/lib/data/products';
import { getProductReviews, hasPurchased } from '@/lib/data/reviews';
import { formatPrice } from '@/lib/format';
import Rating from '@/components/ui/Rating';
import ProductGrid from '@/components/products/ProductGrid';
import ProductGallery from '@/components/products/ProductGallery';
import ProductActions from '@/components/products/ProductActions';
import ReviewsSection from '@/components/reviews/ReviewsSection';
import styles from './ProductPage.module.css';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) return { title: 'Product not found' };

  const { product } = data;
  return {
    title: product.name,
    description: product.description.slice(0, 160),
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 160),
      images: product.images[0] ? [{ url: product.images[0].url, alt: product.images[0].alt }] : [],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const data = await getProductBySlug(slug);
  if (!data) notFound();

  const { product, related } = data;
  const outOfStock = product.countInStock === 0;
  const lowStock = product.countInStock > 0 && product.countInStock <= 5;

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const [reviews, purchased] = await Promise.all([
    getProductReviews(product._id),
    userId ? hasPurchased(product._id, userId) : Promise.resolve(false),
  ]);

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

      <ReviewsSection
        productId={product._id}
        initialReviews={reviews}
        currentUserId={userId}
        isAuthed={Boolean(userId)}
        purchased={purchased}
      />

      {related.length > 0 && (
        <section className={styles.related} aria-labelledby="related-heading">
          <h2 id="related-heading">You might also like</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </main>
  );
}
