/**
 * Global smooth transition lifecycle states for overlay sections.
 *
 * `idle`: At rest (either fully visible or fully hidden).
 * `entering`: Transition IN active (animating from hidden to visible).
 * `entered`: Transition IN finished; now visible on screen.
 * `exiting`: Transition OUT active (animating from visible to hidden).
 * `hidden`: Transition OUT finished; completely removed/hidden.
 */
export type TransitionLifecycle = 'idle' | 'entering' | 'entered' | 'exiting' | 'hidden';

export interface TransitionCallbacks {
  onEntering?(): void;
  onEntered?(): void;
  onExiting?(): void;
  onHidden?(): void;
}
