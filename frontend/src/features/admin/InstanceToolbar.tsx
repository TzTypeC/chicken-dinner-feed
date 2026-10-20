import type { OverlayInstance } from '@cdf/shared';
import { Trash2 } from 'lucide-react';
import { OnAirBadge } from './OnAirBadge';
import { OVERLAY_TYPE_LABELS } from './overlay-types';

export { OVERLAY_TYPE_LABELS };

export interface InstanceToolbarProps {
  instance: OverlayInstance;
  /** Undefined until the live channel reports it — see `OnAirBadge`. */
  visible: boolean | undefined;
  /** False when the draft matches what was last saved. */
  isDirty: boolean;
  onRename(name: string): void;
  onSave(): void;
  onToggleVisibility(): void;
  onDelete(): void;
}

/**
 * The controls that have to stay reachable while the appearance editor is scrolled: rename, save,
 * put on air, delete.
 *
 * Kept with the preview rather than at the top of the form, so adjusting an animation at the bottom
 * of a long page still shows the result and offers the Save button without scrolling back up.
 */
export function InstanceToolbar({
  instance,
  visible,
  isDirty,
  onRename,
  onSave,
  onToggleVisibility,
  onDelete,
}: InstanceToolbarProps) {
  return (
    <div className="border-border bg-card grid gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="rounded border border-[var(--brand-gold)]/40 bg-[var(--brand-gold)]/10 px-2 py-0.5 font-semibold text-[var(--brand-gold)]">
          {OVERLAY_TYPE_LABELS[instance.type] ?? instance.type}
        </span>
        <code className="text-muted-foreground font-mono text-[11px]">/overlay/{instance.id}</code>
      </div>

      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="overlay-name">
          Overlay name
        </label>
        <input
          id="overlay-name"
          type="text"
          className="border-border bg-background min-h-9 min-w-0 flex-1 rounded border px-2 py-1.5 text-sm"
          value={instance.name}
          onChange={(event) => onRename(event.target.value)}
        />

        <button
          type="button"
          className="text-destructive hover:bg-destructive/10 grid size-9 shrink-0 place-items-center rounded transition-colors"
          onClick={onDelete}
          aria-label={`Delete “${instance.name}”`}
          title={`Delete “${instance.name}”`}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!isDirty}
          aria-label={isDirty ? 'Save — there are unsaved changes' : 'Save — nothing has changed'}
          title={isDirty ? 'There are unsaved changes' : 'Nothing has changed since the last save'}
          className={`min-h-9 rounded px-3.5 py-1.5 text-sm font-medium transition-opacity ${
            isDirty
              ? 'bg-primary text-primary-foreground cdf-attention'
              : 'bg-secondary text-muted-foreground cursor-not-allowed'
          }`}
        >
          Save
        </button>

        <div className="border-border ml-auto flex min-h-9 items-center gap-2 rounded border px-2 py-1">
          <OnAirBadge visible={visible} />
          <button
            type="button"
            className="hover:bg-secondary rounded px-2 py-1 text-sm"
            onClick={onToggleVisibility}
          >
            {visible === true ? 'Hide it' : visible === false ? 'Show it' : 'Show / hide'}
          </button>
        </div>
      </div>
    </div>
  );
}
