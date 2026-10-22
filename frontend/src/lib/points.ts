/**
 * An operator adjustment as it should read: `+5`, `−10` (a true minus sign, the same width as the
 * plus in tabular figures) and `0`. Shared by the admin and the postgame overlays so a bonus or a
 * penalty is written the same way everywhere it is shown.
 */
export function formatSignedPoints(points: number): string {
  if (points > 0) return `+${points}`;
  if (points < 0) return `\u2212${Math.abs(points)}`;
  return '0';
}
