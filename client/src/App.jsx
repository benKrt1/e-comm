import { Routes, Route } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Phase 1 shell: verifies the full client stack is wired
 * (Router, Framer Motion, theme variables, bundled fonts).
 * Real pages replace this placeholder from Phase 2 onward.
 */
function Placeholder() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.main
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeContent: 'center',
        textAlign: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-8)',
      }}
    >
      <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)' }}>
        Nord<span style={{ color: 'var(--color-accent)' }}>Cart</span>
      </h1>
      <p style={{ color: 'var(--color-text-muted)', maxWidth: '38ch' }}>
        Nordic-designed tech &amp; audio. Storefront under construction — API scaffolding complete.
      </p>
    </motion.main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="*" element={<Placeholder />} />
    </Routes>
  );
}
