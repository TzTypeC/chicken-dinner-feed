import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { u } from './overlay-scale';
import { MARQUEE_GAP_EM, marqueeTiming } from './team-name-fit';

export interface TeamNameMarqueeProps {
  text: string;
  /** Name font size in design px — the same uniform size every row uses. */
  fontSize: number;
  /** One copy plus its gap, in design px; sets the cycle length at constant speed. */
  distance: number;
  color: string;
}

/** Soft edges, so letters fade in and out of the name cell instead of being sliced. */
const EDGE_MASK = `linear-gradient(to right, transparent 0, #000 ${u(6)}, #000 calc(100% - ${u(6)}), transparent 100%)`;

/**
 * A full team name that does not fit even the extended panel, scrolled right to left forever.
 *
 * Two identical copies, each followed by the same gap, sit in one track; the track travels exactly
 * one copy (−50%) per cycle and repeats. At −50% the second copy occupies the pixels the first
 * started on, so the wrap back to 0 is invisible — and the 1.5 s hold at the start of every cycle
 * happens on that identical frame, with the first letter at the left edge. Driven by the Web
 * Animations API on `transform` only: compositor work, no React state per frame, and each row owns
 * its own animation, cancelled whenever the text, size or distance change (no stale loops).
 *
 * Overlays always animate, per the project's reduced-motion policy (globals.css; Part 8 Q7).
 */
export function TeamNameMarquee({ text, fontSize, distance, color }: TeamNameMarqueeProps) {
  const trackRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || typeof track.animate !== 'function') return;
    const { durationMs, holdOffset } = marqueeTiming(distance);
    const animation = track.animate(
      [
        { transform: 'translateX(0)', offset: 0 },
        { transform: 'translateX(0)', offset: holdOffset },
        { transform: 'translateX(-50%)', offset: 1 },
      ],
      { duration: durationMs, iterations: Infinity, easing: 'linear' },
    );
    return () => animation.cancel();
  }, [text, fontSize, distance]);

  const gap: CSSProperties = {
    display: 'inline-block',
    width: u(MARQUEE_GAP_EM * fontSize),
    textAlign: 'center',
    opacity: 0.45,
  };

  return (
    <span
      data-testid="team-name-marquee"
      className="block min-w-0 flex-1 overflow-hidden"
      style={{ maskImage: EDGE_MASK, WebkitMaskImage: EDGE_MASK }}
      title={text}
    >
      <span
        ref={trackRef}
        className="inline-flex font-bold uppercase tracking-wide whitespace-nowrap"
        style={{ fontSize: u(fontSize), color, willChange: 'transform' }}
      >
        <span>{text}</span>
        <span aria-hidden style={gap}>
          •
        </span>
        <span aria-hidden>{text}</span>
        <span aria-hidden style={gap}>
          •
        </span>
      </span>
    </span>
  );
}
