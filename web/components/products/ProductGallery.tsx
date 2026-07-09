'use client';

import { useState, type MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SerializedProduct } from '@/types';
import styles from '@/app/products/[slug]/ProductPage.module.css';

const PLACEHOLDER = '/placeholder-product.svg';

/** Crossfading main image with cursor-following zoom + thumbnail strip. */
export default function ProductGallery({ product }: { product: SerializedProduct }) {
  const [activeImage, setActiveImage] = useState(0);
  const [zoomOrigin, setZoomOrigin] = useState('50% 50%');
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  const image = product.images[activeImage] ?? product.images[0];

  const handleZoom = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomOrigin(`${x}% ${y}%`);
  };

  const srcFor = (url: string) => (failed[url] ? PLACEHOLDER : url);
  const markFailed = (url: string) => setFailed((f) => ({ ...f, [url]: true }));

  return (
    <section className={styles.gallery} aria-label="Product images">
      <div className={styles.mainImage} onMouseMove={handleZoom}>
        <AnimatePresence mode="wait">
          {/* Plain <img>: the crossfade swaps the element per image and the
              zoom scales it — next/image's wrapper fights both. */}
          <motion.img
            key={image.url}
            src={srcFor(image.url)}
            alt={image.alt}
            style={{ transformOrigin: zoomOrigin }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onError={() => markFailed(image.url)}
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={srcFor(img.url)} alt="" onError={() => markFailed(img.url)} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
