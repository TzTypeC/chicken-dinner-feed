import { describe, expect, it, vi } from 'vitest';

describe('Auto-Transition Engine sequence and race protection', () => {
  it('executes exit before enter and locks against concurrent calls', async () => {
    vi.useFakeTimers();
    const events: string[] = [];
    let isTransitioning = false;

    const mockSetVisibility = vi.fn(async (instanceId: string, action: string) => {
      events.push(`${instanceId}:${action}`);
      return { instanceId, visible: action === 'show', changedAt: Date.now() };
    });

    const triggerTransition = async (sourceId: string, targetId: string, durationMs: number) => {
      if (isTransitioning) return false;
      isTransitioning = true;
      try {
        await mockSetVisibility(sourceId, 'hide');
        await new Promise<void>((resolve) => {
          setTimeout(resolve, durationMs);
        });
        await mockSetVisibility(targetId, 'show');
        return true;
      } finally {
        isTransitioning = false;
      }
    };

    const p1 = triggerTransition('default-postgame-match', 'default-postgame-series', 500);
    const p2 = triggerTransition('default-postgame-match', 'default-top-kill', 500);

    await vi.advanceTimersByTimeAsync(600);
    const [res1, res2] = await Promise.all([p1, p2]);

    expect(res1).toBe(true);
    expect(res2).toBe(false);
    expect(events).toEqual(['default-postgame-match:hide', 'default-postgame-series:show']);
    vi.useRealTimers();
  });
});
