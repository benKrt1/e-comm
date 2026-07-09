'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import styles from './Button.module.css';

// framer-motion widens children to allow MotionValues; this button only ever
// renders plain React content.
interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'ghost';
  isLoading?: boolean;
  children?: ReactNode;
}

/**
 * Base button with the spec's micro-interactions (scale on tap, lift on
 * hover), skipped entirely when the user prefers reduced motion.
 * variant: 'primary' | 'ghost' — isLoading disables and shows a spinner.
 */
export default function Button({
  variant = 'primary',
  isLoading = false,
  disabled = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      whileHover={reduceMotion || disabled || isLoading ? undefined : { y: -2 }}
      whileTap={reduceMotion || disabled || isLoading ? undefined : { scale: 0.96 }}
      className={`${styles.button} ${styles[variant]} ${className}`.trim()}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </motion.button>
  );
}
