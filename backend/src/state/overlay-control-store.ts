import type { OverlayInstance, OverlayVisibility } from '@cdf/shared';

export type OverlayControlListener = (state: OverlayVisibility) => void;

export interface OverlayControlStoreOptions {
  defaultVisible?: boolean;
  onPersist?: (instanceId: string, visible: boolean) => void | Promise<unknown>;
}

/**
 * Show/hide state per overlay instance, driven by the director rather than by the game.
 *
 * Syncs with persisted `instance.onAir` on startup and whenever instances are saved, and persists
 * operator show/hide/toggle actions via `onPersist` when configured.
 */
export class OverlayControlStore {
  private readonly states = new Map<string, OverlayVisibility>();
  private readonly listeners = new Set<OverlayControlListener>();
  private readonly defaultVisible: boolean;
  private readonly onPersist?: (instanceId: string, visible: boolean) => void | Promise<unknown>;

  /**
   * @param defaultVisibleOrOptions Overlays start visible so that opening one shows something. An
   * operator who wants to start hidden can hide it from the Admin Panel or Companion.
   */
  constructor(defaultVisibleOrOptions: boolean | OverlayControlStoreOptions = true) {
    if (typeof defaultVisibleOrOptions === 'boolean') {
      this.defaultVisible = defaultVisibleOrOptions;
    } else {
      this.defaultVisible = defaultVisibleOrOptions.defaultVisible ?? true;
      this.onPersist = defaultVisibleOrOptions.onPersist;
    }
  }

  /**
   * Seed or synchronize in-memory visibility states from persisted overlay instances.
   */
  syncFromInstances(
    instances: readonly Pick<OverlayInstance, 'id' | 'onAir'>[],
    now: number = Date.now(),
  ): void {
    for (const inst of instances) {
      const existing = this.states.get(inst.id);
      const targetVisible = inst.onAir ?? this.defaultVisible;
      if (!existing) {
        this.states.set(inst.id, {
          instanceId: inst.id,
          visible: targetVisible,
          changedAt: 0,
        });
      } else if (existing.visible !== targetVisible) {
        const next: OverlayVisibility = {
          instanceId: inst.id,
          visible: targetVisible,
          changedAt: now,
        };
        this.states.set(inst.id, next);
        for (const listener of this.listeners) listener(next);
      }
    }
  }

  get(instanceId: string): OverlayVisibility {
    const existing = this.states.get(instanceId);
    if (existing) return existing;

    // changedAt of 0 marks "never actually changed", which is how a client tells the state it was
    // born into from one it should animate.
    const created: OverlayVisibility = {
      instanceId,
      visible: this.defaultVisible,
      changedAt: 0,
    };
    this.states.set(instanceId, created);
    return created;
  }

  set(instanceId: string, visible: boolean, now: number = Date.now()): OverlayVisibility {
    const current = this.get(instanceId);

    // Re-pressing "show" on an already-visible overlay must not retrigger the animation — a
    // director tapping a key twice should not make the overlay flicker on air.
    if (current.visible === visible) return current;

    const next: OverlayVisibility = { instanceId, visible, changedAt: now };
    this.states.set(instanceId, next);
    if (this.onPersist) {
      void Promise.resolve(this.onPersist(instanceId, visible)).catch(() => {
        // Persistence errors are handled by ConfigStore warnings
      });
    }
    for (const listener of this.listeners) listener(next);
    return next;
  }

  toggle(instanceId: string, now: number = Date.now()): OverlayVisibility {
    return this.set(instanceId, !this.get(instanceId).visible, now);
  }

  subscribe(listener: OverlayControlListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
