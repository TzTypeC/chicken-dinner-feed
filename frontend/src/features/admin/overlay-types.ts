import type { OverlayType } from '@cdf/shared';

export const OVERLAY_TYPE_LABELS: Record<OverlayType, string> = {
  leaderboard: 'Leaderboard',
  final4: 'Final-4 Top Bar',
  'match-info': 'Match Info',
  elimination: 'Elimination Alert',
  wwcd: 'WWCD (Card)',
  'wwcd-fullscreen': 'WWCD (Fullscreen)',
  'postgame-match': 'Postgame Match',
  'postgame-series': 'Postgame Series',
  'top-kill': 'Top Kill',
  'most-improved': 'Most Improved Team',
  'next-map': 'Next Map / Schedule',
};
