import type { CSSProperties } from 'react';
import { u } from './overlay-scale';

/**
 * Styling shared by the leaderboard row and its hidden name-measuring probe, so what is measured is
 * exactly what is drawn (Part 8).
 */

/** The `T##` slot badge. */
export const SLOT_BADGE_STYLE: CSSProperties = {
  fontSize: u(9.5),
  lineHeight: 1,
  paddingInline: u(4),
  paddingBlock: u(2.5),
  borderRadius: u(2),
  backgroundColor: 'rgba(61, 54, 43, 0.78)',
  border: `${u(1)} solid rgba(129, 96, 54, 0.55)`,
  color: 'var(--overlay-text-muted)',
  letterSpacing: u(0.35),
};
export const SLOT_BADGE_CLASS = 'shrink-0 font-bold uppercase tabular-nums';

/** The team-name text. */
export const TEAM_NAME_CLASS = 'font-bold uppercase tracking-wide whitespace-nowrap';
