'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import Rating from '@/components/ui/Rating';
import WishlistButton from '@/components/wishlist/WishlistButton';
import { formatPrice } from '@/lib/format';
import type { SerializedProduct } from '@/types';
import styles from './ProductCard.module.css';

// Entrance animation is orchestrated by the parent grid's stagger:
// the container switches hidden→visible and these variants inherit it.
const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
};

export default function ProductCard({ product }: { product: SerializedProduct }) {
  const lowStock = product.countInStock > 0 && product.countInStock <= 5;
  const outOfStock = product.countInStock === 0;
  const [src, setSrc] = useState(product.images[0].url);

  return (
    <motion.li variants={cardVariants} className={styles.card}>
      <Link href={`/products/${product.slug}`} className={styles.link}>
        <div className={styles.imageWrap}>
          <Image
            src={src}
            alt={product.images[0].alt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            onError={() => setSrc('/placeholder-product.svg')}
          />
          {outOfStock && <span className={`${styles.badge} ${styles.out}`}>Out of stock</span>}
          {lowStock && <span className={styles.badge}>Only {product.countInStock} left</span>}
        </div>
        <div className={styles.body}>
          <p className={styles.brand}>{product.brand}</p>
          <h3 className={styles.name}>{product.name}</h3>
          <Rating value={product.rating} count={product.numReviews} />
          <p className={styles.price}>{formatPrice(product.price)}</p>
        </div>
      </Link>
      <WishlistButton product={{ _id: product._id, name: product.name }} className={styles.wishlist} />
    </motion.li>
  );
}
