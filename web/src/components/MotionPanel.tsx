import { motion } from 'framer-motion';
import type { PropsWithChildren } from 'react';

export function MotionPanel({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return (
    <motion.section
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      {children}
    </motion.section>
  );
}