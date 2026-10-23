import { AnimatePresence, motion, type Variants } from 'motion/react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import type { TransitionLifecycle } from './transition-state';

export interface TransitionSurfaceProps {
  visible: boolean;
  variants: Variants;
  children: ReactNode;
  testId?: string;
  surfaceKey?: string;
  style?: CSSProperties;
  className?: string;
  onExitComplete?(): void;
  onEntered?(): void;
}

/**
 * Universal wrapper for broadcast overlay surfaces providing smooth transition IN/OUT
 * with observable lifecycle state (`idle` -> `entering` -> `entered` -> `exiting` -> `hidden`).
 */
export function TransitionSurface({
  visible,
  variants,
  children,
  testId,
  surfaceKey = 'surface',
  style,
  className,
  onExitComplete,
  onEntered,
}: TransitionSurfaceProps) {
  const [lifecycle, setLifecycle] = useState<TransitionLifecycle>(visible ? 'idle' : 'hidden');

  return (
    <AnimatePresence
      mode="wait"
      initial={false}
      onExitComplete={() => {
        setLifecycle('hidden');
        onExitComplete?.();
      }}
    >
      {visible && (
        <motion.div
          key={surfaceKey}
          data-testid={testId}
          data-lifecycle-state={lifecycle}
          variants={variants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onAnimationStart={() => {
            setLifecycle(visible ? 'entering' : 'exiting');
          }}
          onAnimationComplete={(definition) => {
            if (definition === 'visible') {
              setLifecycle('entered');
              onEntered?.();
            } else if (definition === 'hidden') {
              setLifecycle('hidden');
            }
          }}
          style={style}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
