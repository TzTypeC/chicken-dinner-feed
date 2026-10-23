import type { SeriesDocument } from '@cdf/shared';
import { useCallback, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useLiveStore } from '@/stores/live-store';
import { toast } from '@/stores/toast-store';

function describe(error: unknown): string {
  return error instanceof ApiError || error instanceof Error ? error.message : String(error);
}

interface UseCloseMapOptions {
  /** Called with the new series document after a close succeeded. */
  onClosed?: (document: SeriesDocument) => void;
  /**
   * Called after every attempt, whatever its outcome — success, refusal or failure — so the caller
   * re-reads the server's state instead of trusting what it showed before the click.
   */
  onSettled?: () => void | Promise<void>;
}

/**
 * Close Current Map, shared by the Series and the Manual control pages so both behave the same.
 *
 * - One request at a time: `closing` disables the buttons and a ref blocks a double-click that lands
 *   before React re-renders.
 * - The request names the match the operator is looking at (`expectedMatchId`, from the live
 *   snapshot), so a stale tab or a repeated click is refused with 409 instead of closing something
 *   else.
 * - The Manual Match is reset by the server, in the same request, only after the close succeeded.
 *   When that follow-up fails the map is still recorded and the operator is told what to do.
 */
export function useCloseMap({ onClosed, onSettled }: UseCloseMapOptions = {}) {
  const runningMatchId = useLiveStore((state) => state.snapshot?.match.matchId ?? undefined);
  const [closing, setClosing] = useState(false);
  const inFlight = useRef(false);

  const close = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setClosing(true);
    try {
      const { document, manualReset } = await api.closeMapNow(runningMatchId);
      onClosed?.(document);
      if (manualReset === 'failed') {
        toast.error(
          'Map closed — the manual match was NOT reset',
          'The map is saved in the series history. Click "Reset manual match" before the next map.',
        );
      } else if (manualReset === 'done') {
        toast.success(
          'Map closed and manual match reset',
          'The result is in the series history and a fresh manual match has started.',
        );
      } else {
        toast.success('Map closed', 'It is now part of the series history.');
      }
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.status === 409
          ? 'That map was already closed'
          : 'Could not close the map',
        describe(error),
      );
    } finally {
      try {
        await onSettled?.();
      } finally {
        inFlight.current = false;
        setClosing(false);
      }
    }
  }, [runningMatchId, onClosed, onSettled]);

  return { closing, close };
}
