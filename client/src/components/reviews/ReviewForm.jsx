import { useState } from 'react';
import api, { getErrorMessage } from '../../api/axios';
import { useToast } from '../../context/ToastContext';
import Button from '../ui/Button';
import Input from '../ui/Input';
import StarInput from './StarInput';
import styles from './ReviewForm.module.css';

/**
 * Create or edit a review. `existing` (a review object) switches the form
 * into edit mode. Calls onSaved(review) with the server's populated copy.
 */
export default function ReviewForm({ productId, existing = null, onSaved, onCancel }) {
  const addToast = useToast();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      addToast('Pick a star rating first', 'error');
      return;
    }
    setSaving(true);
    try {
      const { data } = existing
        ? await api.put(`/reviews/${existing._id}`, { rating, title, comment })
        : await api.post('/reviews', { productId, rating, title, comment });
      addToast(data.message);
      onSaved(data.data.review);
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h3 className={styles.heading}>{existing ? 'Edit your review' : 'Write a review'}</h3>
      <StarInput value={rating} onChange={setRating} />
      <Input
        id="review-title"
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        minLength={2}
        maxLength={100}
      />
      <div className={styles.field}>
        <label htmlFor="review-comment" className={styles.commentLabel}>
          Your review
        </label>
        <textarea
          id="review-comment"
          className={styles.textarea}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          required
          minLength={2}
          maxLength={1000}
          rows={4}
        />
      </div>
      <div className={styles.actions}>
        <Button type="submit" isLoading={saving}>
          {existing ? 'Save changes' : 'Publish review'}
        </Button>
        {existing && (
          <button type="button" className={styles.cancel} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
