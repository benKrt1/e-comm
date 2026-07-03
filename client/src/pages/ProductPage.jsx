import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api, { getErrorMessage } from '../api/axios';
import { useToast } from '../context/ToastContext';
import { formatPrice } from '../utils/format';
import Rating from '../components/ui/Rating';
import Button from '../components/ui/Button';
import Skeleton from '../components/ui/Skeleton';
import ProductGrid from '../components/products/ProductGrid';
import placeholder from '../assets/placeholder-product.svg';
import styles from './ProductPage.module.css';

export default function ProductPage() {
  const { slug } = useParams();
  const addToast = useToast();

  const [data, setData] = useState({ product: null, related: [], loading: true, error: null });
  const [activeImage, setActiveImage] = useState(0);
  const [zoomOrigin, setZoomOrigin] = useState('50% 50%');
  const [quantity, setQuantity] = useState(1);

  // Reset page state when navigating between products (related-product
  // clicks) — render-time adjustment, not an effect.
  const [currentSlug, setCurrentSlug] = useState(slug);
  if (currentSlug !== slug) {
    setCurrentSlug(slug);
    setData({ product: null, related: [], loading: true, error: null });
    setActiveImage(0);
    setQuantity(1);
  }

  useEffect(() => {
    let cancelled = false;
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

  if (error) {
    return (
      <main className={`${styles.page} ${styles.error}`}>
        <h1>{error}</h1>
        <Link to="/products" className={styles.backLink}>
          ← Back to the shop
        </Link>
      </main>
    );
  }

  const outOfStock = product.countInStock === 0;
  const lowStock = product.countInStock > 0 && product.countInStock <= 5;
  const image = product.images[activeImage] ?? product.images[0];

  const handleZoom = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomOrigin(`${x}% ${y}%`);
  };

  return (
    <main className={styles.page}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link to="/products">Shop</Link> / <Link to={`/products?category=${product.category}`}>{product.category}</Link>
      </nav>

      <div className={styles.layout}>
        {/* --- Gallery: crossfading main image with cursor-following zoom --- */}
        <section className={styles.gallery} aria-label="Product images">
          <div className={styles.mainImage} onMouseMove={handleZoom}>
            <AnimatePresence mode="wait">
              <motion.img
                key={image.url}
                src={image.url}
                alt={image.alt}
                style={{ transformOrigin: zoomOrigin }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onError={(e) => {
                  e.currentTarget.src = placeholder;
                }}
              />
            </AnimatePresence>
          </div>
          {product.images.length > 1 && (
            <div className={styles.thumbs}>
              {product.images.map((img, i) => (
                <button
                  key={img.url}
                  className={`${styles.thumb} ${i === activeImage ? styles.thumbActive : ''}`}
                  onClick={() => setActiveImage(i)}
                  aria-label={`Show image ${i + 1}: ${img.alt}`}
                  aria-pressed={i === activeImage}
                >
                  <img src={img.url} alt="" onError={(e) => (e.currentTarget.src = placeholder)} />
                </button>
              ))}
            </div>
          )}
        </section>

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

          <div className={styles.actions}>
            <div className={styles.quantity} role="group" aria-label="Quantity">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={outOfStock || quantity <= 1}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span aria-live="polite">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(product.countInStock, q + 1))}
                disabled={outOfStock || quantity >= product.countInStock}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
            <Button
              disabled={outOfStock}
              onClick={() => addToast('The cart arrives in the next build phase — stay tuned!')}
            >
              {outOfStock ? 'Out of stock' : 'Add to cart'}
            </Button>
          </div>
        </section>
      </div>

      {related.length > 0 && (
        <section className={styles.related} aria-labelledby="related-heading">
          <h2 id="related-heading">You might also like</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </main>
  );
}
