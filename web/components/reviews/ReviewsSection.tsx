'use client';

import { useState, useReducer, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/providers/ToastProvider';
import Rating from '@/components/ui/Rating';
import Spinner from '@/components/ui/Spinner';
import ReviewForm from './ReviewForm';
import type { SerializedReview } from '@/types';
import styles from './ReviewsSection.module.css';

/**
 * The product page's review block: list + (for eligible users) the form.
 * Eligibility = logged in, has a paid order containing this product, and
 * hasn't reviewed it yet — the server re-enforces all three; the client
 * checks only decide what UI to show.
 */
function purchasedReducer(_state: boolean, action: { payload: boolean }) {
  return action.payload;
}

export default function ReviewsSection({ productId }: { productId: string }) {
  const { user, status: authStatus } = useAuth();
  const addToast = useToast();
  const [reviews, setReviews] = useState<SerializedReview[] | null>(null); // null = loading
  const [purchased, dispatchPurchased] = useReducer(purchasedReducer, false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reviews are public — always fetched.
  useEffect(() => {
    let cancelled = false;
    api
      .get(`/reviews?product=${productId}`)
      .then(({ data }) => !cancelled && setReviews(data.data.reviews))
      .catch(() => !cancelled && setReviews([]));
    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Purchase check drives whether the form shows (server still enforces).
  useEffect(() => {
    if (authStatus !== 'authenticated') {
      dispatchPurchased({ payload: false });
      return undefined;
    }
    let cancelled = false;
    api
      .get('/orders/mine')
      .then(({ data }) => {
        if (cancelled) return;
        const bought = data.data.orders.some(
          (order: { isPaid: boolean; orderItems: { product: string }[] }) =>
            order.isPaid && order.orderItems.some((item) => item.product === productId)
        );
        dispatchPurchased({ payload: bought });
      })
      .catch(() => !cancelled && dispatchPurchased({ payload: false }));
    return () => {
      cancelled = true;
    };
  }, [authStatus, productId]);

  if (reviews === null) {
    return (
      <section className={styles.section} aria-busy="true">
        <h2>Reviews</h2>
        <Spinner />
      </section>
    );
  }

  const ownReview = user ? reviews.find((review) => review.user._id === user.id) : null;
  const average = reviews.length
    ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10) / 10
    : 0;

  const handleSaved = (review: SerializedReview) => {
    const next = ownReview
      ? reviews.map((item) => (item._id === review._id ? review : item))
      : [review, ...reviews];
    setReviews(next);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!ownReview) return;
    setDeleting(true);
    try {
      await api.delete(`/reviews/${ownReview._id}`);
      setReviews(reviews.filter((review) => review._id !== ownReview._id));
      setEditing(false);
      addToast('Review deleted');
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className={styles.section} aria-labelledby="reviews-heading">
      <div className={styles.header}>
        <h2 id="reviews-heading">Reviews</h2>
        {reviews.length > 0 && <Rating value={average} count={reviews.length} />}
      </div>

      {/* Form slot: create (purchased, no review yet) or edit (own review). */}
      {authStatus === 'authenticated' && purchased && !ownReview && (
        <ReviewForm productId={productId} onSaved={handleSaved} />
      )}
      {ownReview && editing && (
        <ReviewForm productId={productId} existing={ownReview} onSaved={handleSaved} onCancel={() => setEditing(false)} />
      )}

      {reviews.length === 0 ? (
        <p className={styles.emptyNote}>
          No reviews yet.{' '}
          {authStatus !== 'authenticated' && (
            <>
              <Link href="/login" className={styles.loginLink}>
                Log in
              </Link>{' '}
              to review a product you have bought.
            </>
          )}
        </p>
      ) : (
        <ul className={styles.list}>
          {reviews.map((review) => (
            <li key={review._id} className={styles.review}>
              <div className={styles.reviewHeader}>
                <Rating value={review.rating} />
                <span className={styles.author}>{review.user.name}</span>
                <time className={styles.date} dateTime={review.createdAt}>
                  {new Date(review.createdAt).toLocaleDateString('sv-SE')}
                </time>
              </div>
              <h3 className={styles.reviewTitle}>{review.title}</h3>
              <p className={styles.comment}>{review.comment}</p>
              {ownReview && review._id === ownReview._id && !editing && (
                <div className={styles.ownActions}>
                  <button className={styles.edit} onClick={() => setEditing(true)}>
                    Edit
                  </button>
                  <button className={styles.delete} onClick={handleDelete} disabled={deleting}>
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
