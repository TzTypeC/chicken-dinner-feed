import type { ManualStore } from './manual-store.js';
import type { SeriesStore } from './series-store.js';

/**
 * Closing a manual map is two writes in two documents: the map is recorded in `series.json` first,
 * and the Manual Match in `manual-match.json` is reset second. There is no transaction across them,
 * so a process that stops in between leaves a manual match whose id is already in the history.
 *
 * Called once at startup, this finishes that reset. It is safe by construction: it only runs when
 * Manual mode is active and the manual match's own id is already recorded (so its result is
 * persisted and nothing is lost), it writes only `manual-match.json`, and after it ran the manual
 * match has a new id, so running it again does nothing.
 *
 * @returns whether a pending reset was found and completed.
 */
export async function finishPendingManualReset(
  manual: ManualStore,
  series: SeriesStore,
): Promise<boolean> {
  if (manual.getMode() !== 'manual') return false;
  if (!series.hasClosedMap(manual.getState().matchId)) return false;

  await manual.resetMatch({});
  return true;
}
