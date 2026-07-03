import styles from './Skeleton.module.css';

/**
 * Shimmering placeholder block. Size it from the parent via className
 * or inline style; it fills whatever box it's given.
 */
export default function Skeleton({ className = '', style }) {
  return <span className={`${styles.skeleton} ${className}`.trim()} style={style} aria-hidden="true" />;
}
