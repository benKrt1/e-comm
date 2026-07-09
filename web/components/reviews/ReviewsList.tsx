import Link from 'next/link';
import Rating from '@/components/ui/Rating';
import { getProductReviews } from '@/lib/data/reviews';
import styles from './ReviewsSection.module.css';

/**
 * Server-rendered, read-only review list for the product page. The review
 * form (create/edit/delete for verified purchasers) lands in the reviews
 * phase of the migration — this renders the public side.
 */
export default async function ReviewsList({ productId }: { productId: string }) {
  const reviews = await getProductReviews(productId);

  const average = reviews.length
    ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10) / 10
    : 0;

  return (
    <section className={styles.section} aria-labelledby="reviews-heading">
      <div className={styles.header}>
        <h2 id="reviews-heading">Reviews</h2>
        {reviews.length > 0 && <Rating value={average} count={reviews.length} />}
      </div>

      {reviews.length === 0 ? (
        <p className={styles.emptyNote}>
          No reviews yet.{' '}
          <Link href="/login" className={styles.loginLink}>
            Log in
          </Link>{' '}
          to review a product you have bought.
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
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
