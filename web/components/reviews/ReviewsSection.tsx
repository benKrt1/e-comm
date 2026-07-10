'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/providers/ToastProvider';
import { getErrorMessage } from '@/lib/errors';
import { deleteReviewAction } from '@/actions/reviews';
import Rating from '@/components/ui/Rating';
import ReviewForm from './ReviewForm';
import type { SerializedReview } from '@/types';
import styles from './ReviewsSection.module.css';

interface ReviewsSectionProps {
  productId: string;
  initialReviews: SerializedReview[];
  currentUserId: string | null;
  isAuthed: boolean;
  purchased: boolean;
}

/**
 * The product page's review block: list + (for eligible users) the form.
 * Eligibility = logged in, has a paid order containing this product, and
 * hasn't reviewed it yet — the server re-enforces all three; the client
 * checks only decide what UI to show.
 *
 * initialReviews arrives server-rendered (SEO). After any write we update
 * local state for instant feedback and router.refresh() so the product
 * header's denormalized rating reflects the recalc.
 */
export default function ReviewsSection({
  productId,
  initialReviews,
  currentUserId,
  isAuthed,
  purchased,
}: ReviewsSectionProps) {
  const router = useRouter();
  const addToast = useToast();
  const [reviews, setReviews] = useState(initialReviews);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const ownReview = currentUserId ? reviews.find((review) => review.user._id === currentUserId) : null;
  const average = reviews.length
    ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10) / 10
    : 0;

  const handleSaved = (review: SerializedReview) => {
    const next = ownReview
      ? reviews.map((item) => (item._id === review._id ? review : item))
      : [review, ...reviews];
    setReviews(next);
    setEditing(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!ownReview) return;
    setDeleting(true);
    const result = await deleteReviewAction(ownReview._id);
    setDeleting(false);
    if (!result.success) {
      addToast(getErrorMessage(new Error(result.message)), 'error');
      return;
    }
    setReviews(reviews.filter((review) => review._id !== ownReview._id));
    setEditing(false);
    addToast('Review deleted');
    router.refresh();
  };

  return (
    <section className={styles.section} aria-labelledby="reviews-heading">
      <div className={styles.header}>
        <h2 id="reviews-heading">Reviews</h2>
        {reviews.length > 0 && <Rating value={average} count={reviews.length} />}
      </div>

      {/* Form slot: create (purchased, no review yet) or edit (own review). */}
      {isAuthed && purchased && !ownReview && <ReviewForm productId={productId} onSaved={handleSaved} />}
      {ownReview && editing && (
        <ReviewForm
          productId={productId}
          existing={ownReview}
          onSaved={handleSaved}
          onCancel={() => setEditing(false)}
        />
      )}

      {reviews.length === 0 ? (
        <p className={styles.emptyNote}>
          No reviews yet.{' '}
          {!isAuthed && (
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
