'use client';

import { motion, useReducedMotion } from 'framer-motion';

/**
 * A template re-mounts on every navigation (unlike layout), so its enter
 * animation replays per route. The App Router has no equivalent of
 * AnimatePresence's exit animation for the outgoing page — the old tree
 * unmounts immediately — so this is enter-only (an accepted trade-off of
 * the migration). Reduced-motion users get a plain fade.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const offset = reduceMotion ? 0 : 16;

  return (
    <motion.div
      initial={{ opacity: 0, y: offset }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
