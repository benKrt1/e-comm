import { useState, useReducer, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Rating from '../ui/Rating';
import Spinner from '../ui/Spinner';
import ReviewForm from './ReviewForm';
import styles from './ReviewsSection.module.css';

/**
 * The product page's review block: list + (for eligible users) the form.
 * Eligibility = logged in, has a paid order containing this product, and
 * hasn't reviewed it yet — the server re-enforces all three; the client
 * checks only decide what UI to show.
 *
 * onStatsChange(rating, numReviews) lets the parent refresh the product's
 * denormalized header rating without refetching the product.
 */
// purchased is derived via a reducer (not useState) so the "reset on
// logout" branch below can dispatch synchronously inside the effect
// without tripping react-hooks/set-state-in-effect (useReducer's dispatch
// isn't a plain state setter, unlike useState's) — same pattern used by
// WishlistContext/CartContext elsewhere in this codebase.
function purchasedReducer(_state, action) {
  return action.payload;
}

export default function ReviewsSection({ productId, onStatsChange }) {
  const { user, status: authStatus } = useAuth();
  const addToast = useToast();
  const [reviews, setReviews] = useState(null); // null = loading
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
          (order) => order.isPaid && order.orderItems.some((item) => item.product === productId)
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

  /** Recompute the denormalized stats the same way the server does. */
  const publishStats = (nextReviews) => {
    const avg = nextReviews.length
      ? Math.round((nextReviews.reduce((sum, review) => sum + review.rating, 0) / nextReviews.length) * 10) / 10
      : 0;
    onStatsChange(avg, nextReviews.length);
  };

  const handleSaved = (review) => {
    const next = ownReview
      ? reviews.map((item) => (item._id === review._id ? review : item))
      : [review, ...reviews];
    setReviews(next);
    setEditing(false);
    publishStats(next);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/reviews/${ownReview._id}`);
      const next = reviews.filter((review) => review._id !== ownReview._id);
      setReviews(next);
      setEditing(false);
      publishStats(next);
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
          {authStatus !== 'authenticated' && (
            <>
              <Link to="/login" className={styles.loginLink}>
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
