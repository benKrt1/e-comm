import { motion, useReducedMotion } from 'framer-motion';

/**
 * Wraps every routed page: fade + slide on enter/exit, driven by the
 * AnimatePresence in App. Reduced-motion users get a plain fade.
 */
export default function PageTransition({ children }) {
  const reduceMotion = useReducedMotion();
  const offset = reduceMotion ? 0 : 16;

  return (
    <motion.div
      initial={{ opacity: 0, y: offset }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -offset }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
