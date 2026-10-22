import { TEAM_NAME_DISPLAY_LIMITS, type OverlayAppearance } from '@cdf/shared';
import { useEffect, useState } from 'react';
import { maxExtensionOnCanvas, truncateTeamName } from '@/components/overlay/team-name-fit';

/** Strict whole-number check for a bounded setting; never coerces malformed input. */
function validateInteger(raw: string, min: number, max: number): string | null {
  if (!/^\d+$/.test(raw.trim())) return 'Enter a whole number.';
  const value = Number(raw);
  if (value < min || value > max) return `Must be between ${min} and ${max}.`;
  return null;
}

interface IntegerFieldProps {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onValid(value: number): void;
  onErrorChange(error: string | null): void;
}

/**
 * A bounded number field that keeps the operator's text as typed: an invalid entry shows an error
 * and reports itself (so Save is blocked) instead of being silently replaced by 0 or the old value.
 */
function IntegerField({ label, hint, value, min, max, onValid, onErrorChange }: IntegerFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const error = validateInteger(draft, min, max);

  // An outside change (Save, switching instance, discarding) wins over a stale draft.
  useEffect(() => {
    setDraft((current) =>
      validateInteger(current, min, max) === null && Number(current) === value
        ? current
        : String(value),
    );
  }, [value, min, max]);

  useEffect(() => onErrorChange(error), [error, onErrorChange]);

  return (
    <label className="grid gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        aria-invalid={error !== null}
        className={`bg-background min-h-9 rounded border px-2 py-1.5 text-sm tabular-nums ${
          error ? 'border-destructive' : 'border-border'
        }`}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          if (validateInteger(event.target.value, min, max) === null) {
            onValid(Number(event.target.value));
          }
        }}
      />
      {error ? (
        <span className="text-destructive">{error}</span>
      ) : (
        <span className="text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}

export interface TeamNameSettingsProps {
  appearance: OverlayAppearance;
  patch(changes: Partial<OverlayAppearance>): void;
  /** Reports the first invalid entry (or null), so the toolbar can refuse to save it. */
  onValidityChange(error: string | null): void;
}

const EXAMPLE_NAME = 'Lanang nak chicken main pubg';

/**
 * Part 8 Feature A/B controls for the vertical leaderboard: the character limit, extended mode and
 * the extended-mode width cap. Display-only — stored team names are never changed.
 */
export function TeamNameSettings({ appearance, patch, onValidityChange }: TeamNameSettingsProps) {
  const { maxChars, maxExtension } = TEAM_NAME_DISPLAY_LIMITS;
  const [charsError, setCharsError] = useState<string | null>(null);
  const [extensionError, setExtensionError] = useState<string | null>(null);

  useEffect(() => {
    onValidityChange(
      charsError
        ? `Max characters: ${charsError}`
        : extensionError
          ? `Max extension: ${extensionError}`
          : null,
    );
  }, [charsError, extensionError, onValidityChange]);
  // Leaving this editor (another instance, another type) must not leave Save blocked.
  useEffect(() => () => onValidityChange(null), [onValidityChange]);
  const extended = appearance.teamNameExtendedMode;
  const effectiveExtension = maxExtensionOnCanvas({
    anchor: appearance.anchor,
    offsetX: appearance.offsetX,
    scale: appearance.scale,
    configured: appearance.teamNameMaxExtension,
  });

  return (
    <section className="grid gap-3" data-testid="team-name-settings">
      <div>
        <h3 className="text-sm font-medium">Team names</h3>
        <p className="text-muted-foreground text-xs">
          How the leaderboard prints team names. Every row uses one font size, set by the character
          limit; the panel keeps its normal width and right edge. Stored team names are never
          changed. Press Save to apply.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <IntegerField
          label={`Max characters shown (${maxChars.min}–${maxChars.max})`}
          hint={`Example: “${truncateTeamName(EXAMPLE_NAME, appearance.teamNameMaxChars)}” — emoji count as 1; the “...” counts toward the limit.`}
          value={appearance.teamNameMaxChars}
          min={maxChars.min}
          max={maxChars.max}
          onValid={(value) => patch({ teamNameMaxChars: value })}
          onErrorChange={setCharsError}
        />
        <IntegerField
          label={`Max extension to the left (${maxExtension.min}–${maxExtension.max} px)`}
          hint={
            effectiveExtension < appearance.teamNameMaxExtension
              ? `Limited to ${effectiveExtension} px here so the panel stays on screen (${appearance.anchor}-anchored at ${appearance.offsetX} px).`
              : 'Extended mode only. 1080p pixels; the panel grows leftward as far as the longest name needs.'
          }
          value={appearance.teamNameMaxExtension}
          min={maxExtension.min}
          max={maxExtension.max}
          onValid={(value) => patch({ teamNameMaxExtension: value })}
          onErrorChange={setExtensionError}
        />
      </div>

      <div className="border-border bg-secondary/15 flex items-center justify-between gap-3 rounded border px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">Extended mode (full names, scrolling)</div>
          <p className="text-muted-foreground text-xs">
            Shows full names without “...”. The panel widens to the left up to the maximum above; a
            name that still does not fit scrolls right to left. OFF returns to the normal width and
            “...” immediately.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={extended}
          aria-label="Extended mode (full names, scrolling)"
          onClick={() => patch({ teamNameExtendedMode: !extended })}
          className={`min-h-9 min-w-[4.25rem] shrink-0 rounded border px-3 py-1 text-xs font-semibold transition-colors ${
            extended
              ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)] text-black'
              : 'border-border bg-background text-muted-foreground hover:text-foreground'
          }`}
        >
          {extended ? 'ON' : 'OFF'}
        </button>
      </div>
    </section>
  );
}
