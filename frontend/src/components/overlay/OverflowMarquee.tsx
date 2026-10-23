import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { MARQUEE_GAP_EM, marqueeTiming } from './team-name-fit';

export interface OverflowMarqueeProps {
  text: string;
  /**
   * The text's font size in design px. Only used to turn the scroll speed (design px per second)
   * into real px: `unit = computed font size ÷ fontSize`.
   */
  fontSize: number;
  /** The CSS `font-size` to draw with, written in the surface's unit (`u()` or `ub()`). */
  fontSizeCss: string;
  color: string;
  /** Font classes (weight, case, tracking). */
  className?: string;
  testId?: string;
  /**
   * While true the scroll decision is held: size changes are ignored and the current state (still
   * or scrolling) is kept. The tower sets it while the panel width is transitioning, so a name never
   * starts scrolling in a half-wide column and stops again a moment later (Part 10). When it turns
   * false the cell is measured once more.
   */
  frozen?: boolean;
}

/**
 * Overflow beyond this many pixels starts the scroll. Half a pixel is below anything visible, so a
 * name that fits to within rounding stays still.
 */
const OVERFLOW_TOLERANCE_PX = 0.5;

/** Soft edges, so letters fade in and out of the cell instead of being sliced. */
const EDGE_MASK =
  'linear-gradient(to right, transparent 0, #000 6px, #000 calc(100% - 6px), transparent 100%)';

const GAP_STYLE: CSSProperties = {
  display: 'inline-block',
  width: `${MARQUEE_GAP_EM}em`,
  textAlign: 'center',
  opacity: 0.45,
};

/**
 * A team name that is shown in full: still when it fits, scrolling right to left when it does not.
 * Never an ellipsis (Part 9). Used by the extended-mode tower and the Final 4 cards.
 *
 * The decision comes from what is actually on screen — the name's width against its cell's width,
 * measured in the same coordinate space — not from a prediction. That makes it independent of the
 * overlay's scale, the browser source's resolution, a still-loading web font and any transform an
 * ancestor is animating (a zoom entrance scales both boxes equally). A `ResizeObserver` watches the
 * cell and the text, and it ignores CSS transforms, so only real layout changes re-decide.
 *
 * Scrolling is one Web Animations `translateX(0 → −50%)` loop over two copies of the name, each
 * followed by a gap: at −50% the second copy sits exactly where the first started, so the wrap is
 * invisible. Constant speed (`marqueeTiming`), a hold on the first letter every cycle, compositor-
 * friendly (`transform` only), no React state per frame, cancelled on any change or unmount.
 *
 * Overlays always animate, per the project's reduced-motion policy (globals.css; Part 8 Q7).
 */
export function OverflowMarquee({
  text,
  fontSize,
  fontSizeCss,
  color,
  className = '',
  testId,
  frozen = false,
}: OverflowMarqueeProps) {
  const viewportRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLSpanElement>(null);
  const copyRef = useRef<HTMLSpanElement>(null);
  const [scrolling, setScrolling] = useState(false);
  /** One copy's layout width in whole px; changes when the text, font or scale really change. */
  const [copyWidth, setCopyWidth] = useState(0);

  // Decide before the first paint, then follow real layout changes — unless frozen.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const copy = copyRef.current;
    if (!viewport || !copy || frozen) return;

    const measure = () => {
      const viewportWidth = viewport.getBoundingClientRect().width;
      // Not laid out (hidden): keep the last decision rather than guess.
      if (viewportWidth === 0) return;
      setScrolling(copy.getBoundingClientRect().width - viewportWidth > OVERFLOW_TOLERANCE_PX);
      setCopyWidth(copy.offsetWidth);
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(copy);
    return () => observer.disconnect();
  }, [text, fontSizeCss, frozen]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!scrolling || !track || typeof track.animate !== 'function') return;

    const unitPx = parseFloat(getComputedStyle(track).fontSize) / fontSize;
    // One copy plus its gap — half the track — in design px.
    const cycleDesignPx = track.offsetWidth / 2 / unitPx;
    const { durationMs, holdOffset } = marqueeTiming(cycleDesignPx);
    const animation = track.animate(
      [
        { transform: 'translateX(0)', offset: 0 },
        { transform: 'translateX(0)', offset: holdOffset },
        { transform: 'translateX(-50%)', offset: 1 },
      ],
      { duration: durationMs, iterations: Infinity, easing: 'linear' },
    );
    return () => animation.cancel();
  }, [scrolling, text, fontSize, fontSizeCss, copyWidth]);

  return (
    <span
      ref={viewportRef}
      data-testid={testId}
      data-scrolling={scrolling}
      className="block min-w-0 flex-1 overflow-hidden whitespace-nowrap"
      style={{
        textOverflow: 'clip',
        ...(scrolling ? { maskImage: EDGE_MASK, WebkitMaskImage: EDGE_MASK } : {}),
      }}
      title={text}
    >
      <span
        ref={trackRef}
        className={`inline-flex whitespace-nowrap ${className}`}
        style={{ fontSize: fontSizeCss, color }}
      >
        <span ref={copyRef}>{text}</span>
        {scrolling && (
          <>
            <span aria-hidden style={GAP_STYLE}>
              •
            </span>
            <span aria-hidden>{text}</span>
            <span aria-hidden style={GAP_STYLE}>
              •
            </span>
          </>
        )}
      </span>
    </span>
  );
}
