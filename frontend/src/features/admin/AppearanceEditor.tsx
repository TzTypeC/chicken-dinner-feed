import type {
  ClosedMapResult,
  CustomFont,
  OverlayAnimation,
  OverlayAnimationDirection,
  OverlayAnimationType,
  OverlayAppearance,
  OverlayColors,
  OverlayType,
  PostGameBackground,
  PostGameBackgroundMode,
} from '@cdf/shared';
import {
  DEFAULT_POST_GAME_BACKGROUND,
  fontFamilyValue,
  PMCC_2026_OVERLAY_COLORS,
} from '@cdf/shared';
import { AlertTriangle } from 'lucide-react';
import { useRef, useState } from 'react';
import { isPinnedPostGameMatchUnavailable } from '@/components/overlay/broadcast-state';
import { ColorField } from './ColorField';
import { TeamNameSettings } from './TeamNameSettings';

/**
 * Each of the first three is one concrete weight, loaded live from Google Fonts (index.html) — not
 * a family with a range of weights still open, since only that one weight is ever fetched. Labelled
 * accordingly ("Inter Bold", not "Inter") so the picker does not promise a choice that is not there.
 *
 * "Arial" needs no network at all — a plain, universally-installed Windows font, offered for an
 * operator with no internet on site. Without it, or if Google Fonts genuinely cannot be reached,
 * each of the first three quietly falls back to the next entry in its own stack instead of failing.
 */
const FONT_OPTIONS = [
  { value: "'Inter', system-ui, sans-serif", label: 'Inter Bold' },
  { value: "'Rajdhani', system-ui, sans-serif", label: 'Rajdhani SemiBold' },
  { value: "'Barlow Condensed', system-ui, sans-serif", label: 'Barlow Condensed SemiBold' },
  { value: 'Arial, system-ui, sans-serif', label: 'Arial' },
  { value: "'Courier New', monospace", label: 'Monospace' },
];

export interface AppearanceEditorProps {
  appearance: OverlayAppearance;
  instanceType?: OverlayType;
  /** Completed matches in the current series (`series.json`), for Postgame Match selection (`D-PMCC-09`). */
  closedMaps?: readonly ClosedMapResult[];
  /** Uploaded fonts, offered alongside the built-in choices. */
  customFonts: CustomFont[];
  onChange(appearance: OverlayAppearance): void;
  onUploadBackground?(file: File): Promise<void>;
  onRemoveBackground?(): Promise<void>;
  /** Reports an invalid entry (or null) so the toolbar can refuse to save it. */
  onValidityChange?(error: string | null): void;
}

const ignoreValidity = () => {};

export function AppearanceEditor({
  appearance,
  instanceType = 'leaderboard',
  closedMaps = [],
  customFonts,
  onChange,
  onUploadBackground,
  onRemoveBackground,
  onValidityChange = ignoreValidity,
}: AppearanceEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingBg, setUploadingBg] = useState(false);

  const patch = (changes: Partial<OverlayAppearance>) => onChange({ ...appearance, ...changes });
  const patchColor = (key: keyof OverlayColors, value: string) =>
    patch({ colors: { ...appearance.colors, [key]: value } });

  const postGameBg: PostGameBackground =
    appearance.postGameBackground ?? DEFAULT_POST_GAME_BACKGROUND;
  const patchPostGameBg = (changes: Partial<PostGameBackground>) =>
    patch({ postGameBackground: { ...postGameBg, ...changes } });

  const animation = appearance.animation;
  const patchAnimation = (changes: Partial<OverlayAnimation>) =>
    patch({ animation: { ...animation, ...changes } });
  const patchRows = (changes: Partial<OverlayAnimation['rows']>) =>
    patchAnimation({ rows: { ...animation.rows, ...changes } });

  const hasDirection = animation.type === 'wipe' || animation.type === 'slide';
  const plainName = animation.type === 'zoom-fade' ? 'zoom' : animation.type;
  const fadeHint =
    animation.type === 'fade' ? '— already a fade' : `— off leaves a plain ${plainName}`;
  const rowSweepSeconds = ((appearance.maxTeams * animation.rows.staggerMs) / 1000).toFixed(1);

  const selectedMatchId = appearance.postGameMatchSelection ?? 'latest';
  const isPinnedUnavailable =
    instanceType === 'postgame-match' &&
    isPinnedPostGameMatchUnavailable(selectedMatchId, closedMaps);

  // Scoped toggle items applicable to the current instanceType:
  const toggleItems: {
    key: keyof OverlayAppearance;
    label: string;
    description: string;
    value: boolean;
    types: OverlayType[];
  }[] = [
    {
      key: 'showLogos',
      label: 'Team logos',
      description:
        'Show team logos on this overlay surface. When OFF, the logo column or badge collapses cleanly.',
      value: appearance.showLogos ?? true,
      types: [
        'leaderboard',
        'final4',
        'elimination',
        'wwcd',
        'wwcd-fullscreen',
        'postgame-match',
        'postgame-series',
      ],
    },
    {
      key: 'showTeamNumbers',
      label: 'Persistent team slot badges (T01–T25)',
      description:
        'Display each squad’s fixed tournament slot identifier (T01–T25) alongside its placement rank.',
      value: appearance.showTeamNumbers ?? true,
      types: [
        'leaderboard',
        'final4',
        'elimination',
        'wwcd',
        'wwcd-fullscreen',
        'postgame-match',
        'postgame-series',
      ],
    },
    {
      key: 'showFinalFourLayout',
      label: 'Automatic Final-4 top bar',
      description:
        'Enable the 4-column top-center Final-4 squad bar when 4, 3, or 2 teams remain alive.',
      value: appearance.showFinalFourLayout ?? true,
      types: ['leaderboard', 'final4'],
    },
    {
      key: 'showWwcdOverlay',
      label: 'Automatic WWCD victory screen',
      description:
        'Allow this overlay to transition to the Winner Winner Chicken Dinner celebration when 1 team remains alive.',
      value: appearance.showWwcdOverlay ?? true,
      types: ['leaderboard', 'wwcd', 'wwcd-fullscreen'],
    },
    {
      key: 'showLegend',
      label: 'Player status legend',
      description: 'Show the Alive / Knocked / Eliminated colour legend in the leaderboard header.',
      value: appearance.showLegend,
      types: ['leaderboard'],
    },
    {
      key: 'showEliminationAlerts',
      label: 'Elimination notification overlay',
      description: 'Master switch for live team-elimination banners.',
      value: appearance.showEliminationAlerts ?? true,
      types: ['leaderboard', 'elimination'],
    },
    {
      key: 'showEliminationAlertElims',
      label: 'Elimination count on alert',
      description:
        'Display the eliminated squad’s match kill total (ELIMS) on the elimination banner.',
      value: appearance.showEliminationAlertElims ?? true,
      types: ['leaderboard', 'elimination'],
    },
    {
      key: 'showMatchInfo',
      label: 'Match information overlay',
      description: 'Master switch for the MATCH N · MAP pill.',
      value: appearance.showMatchInfo ?? true,
      types: ['leaderboard', 'match-info'],
    },
    {
      key: 'showMatchInfoMapName',
      label: 'Map name on match info',
      description: 'Show the map name alongside the match number on the Match Info pill.',
      value: appearance.showMatchInfoMapName ?? true,
      types: ['leaderboard', 'match-info'],
    },
    {
      key: 'showFullscreenCharacters',
      label: 'Fullscreen WWCD 5-character squad lineup',
      description:
        'Show the 5-character PUBG squad lineup standing on the championship victory stage.',
      value: appearance.showFullscreenCharacters ?? true,
      types: ['wwcd-fullscreen'],
    },
    {
      key: 'showFullscreenMarquee',
      label: 'Fullscreen WWCD scrolling marquee ribbon',
      description:
        'Show the scrolling “WINNER WINNER CHICKEN DINNER” ticker ribbon above the 4-column stats bar.',
      value: appearance.showFullscreenMarquee ?? true,
      types: ['wwcd-fullscreen'],
    },
    {
      key: 'showFullscreenStageBg',
      label: 'Fullscreen WWCD 3D stage background',
      description:
        'Render the full-screen 3D victory stage backdrop. Turn OFF for a transparent OBS canvas over live game video.',
      value: appearance.showFullscreenStageBg ?? true,
      types: ['wwcd-fullscreen'],
    },
    {
      key: 'showSeriesWwcdColumn',
      label: 'Chicken Dinners (WWCD) column on Series Standings',
      description:
        'Show each team’s total Chicken Dinner count (WWCD) alongside Matches Played (M) on Postgame Series.',
      value: appearance.showSeriesWwcdColumn ?? true,
      types: ['postgame-series'],
    },
  ];

  const visibleToggles = toggleItems.filter((item) => item.types.includes(instanceType));
  const supportsAnchorOffset = instanceType === 'leaderboard';
  const supportsMaxTeams = instanceType === 'leaderboard';
  const supportsPlayerColors =
    instanceType === 'leaderboard' || instanceType === 'final4' || instanceType === 'wwcd';
  const supportsBackgroundMedia =
    instanceType === 'postgame-match' ||
    instanceType === 'postgame-series' ||
    instanceType === 'wwcd-fullscreen' ||
    instanceType === 'leaderboard';
  const supportsShowHideAnimation =
    instanceType === 'leaderboard' ||
    instanceType === 'postgame-match' ||
    instanceType === 'postgame-series';
  const supportsRowStagger = instanceType === 'leaderboard';

  return (
    <div className="grid gap-6">
      {/* D-PMCC-09: Selectable Historical Match for Postgame Match */}
      {instanceType === 'postgame-match' && (
        <section
          data-testid="postgame-match-selector-section"
          className="border-border bg-secondary/20 grid gap-3 rounded-lg border p-3.5"
        >
          <div>
            <h3 className="text-sm font-medium text-[var(--brand-gold)]">
              Displayed Match Results (Postgame Match)
            </h3>
            <p className="text-muted-foreground text-xs">
              Choose whether this Postgame Match instance automatically displays the latest
              completed match or stays pinned to a specific historical match from the series. Press
              Save to apply.
            </p>
          </div>

          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Completed match source</span>
            <select
              aria-label="Completed match source"
              data-testid="postgame-match-selector"
              className="border-border bg-background min-h-9 rounded border px-2.5 py-1.5 text-sm"
              value={selectedMatchId}
              onChange={(event) => patch({ postGameMatchSelection: event.target.value })}
            >
              <option value="latest">Latest completed match (Automatic)</option>
              {closedMaps.map((map) => (
                <option key={map.id} value={map.id}>
                  Match {map.mapNumber}
                  {map.mapName ? ` — ${map.mapName}` : ''} ({map.teams.length} teams)
                </option>
              ))}
              {isPinnedUnavailable && (
                <option value={selectedMatchId}>
                  Unavailable match ({selectedMatchId}) — removed or reset
                </option>
              )}
            </select>
          </label>

          {isPinnedUnavailable && (
            <div
              data-testid="postgame-match-unavailable-warning"
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0 text-amber-400" aria-hidden />
                <span>
                  The pinned match (<code className="font-mono">{selectedMatchId}</code>) is no
                  longer in series history. The overlay shows an unavailable warning instead of
                  silently substituting another match.
                </span>
              </div>
              <button
                type="button"
                onClick={() => patch({ postGameMatchSelection: 'latest' })}
                className="min-h-7 shrink-0 rounded border border-amber-400/60 bg-amber-400/20 px-2.5 py-1 font-medium text-amber-100 hover:bg-amber-400/30"
              >
                Use Latest completed match
              </button>
            </div>
          )}
        </section>
      )}

      {visibleToggles.length > 0 && (
        <section className="grid gap-3">
          <div>
            <h3 className="text-sm font-medium">Broadcast elements &amp; overlay toggles</h3>
            <p className="text-muted-foreground text-xs">
              Turn individual overlay elements on or off for this instance. Press Save to apply to
              all connected browser sources.
            </p>
          </div>

          <div className="grid gap-2">
            {visibleToggles.map((item) => (
              <div
                key={item.key}
                className="border-border bg-secondary/15 flex items-center justify-between gap-3 rounded border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{item.label}</div>
                  <p className="text-muted-foreground text-xs">{item.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={item.value}
                  aria-label={item.label}
                  onClick={() => patch({ [item.key]: !item.value })}
                  className={`min-h-9 min-w-[4.25rem] shrink-0 rounded border px-3 py-1 text-xs font-semibold transition-colors ${
                    item.value
                      ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)] text-black'
                      : 'border-border bg-background text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {item.value ? 'ON' : 'OFF'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-3">
        <h3 className="text-sm font-medium">
          {supportsAnchorOffset ? 'Placement & scale' : 'Scale'}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {supportsAnchorOffset && (
            <>
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">Side</span>
                <select
                  className="border-border bg-background min-h-9 rounded border px-2 py-1.5 text-sm"
                  value={appearance.anchor}
                  onChange={(event) => patch({ anchor: event.target.value as 'left' | 'right' })}
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </label>

              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">Distance from that edge</span>
                <input
                  type="number"
                  min={0}
                  max={1800}
                  className="border-border bg-background min-h-9 rounded border px-2 py-1.5 text-sm"
                  value={appearance.offsetX}
                  onChange={(event) => patch({ offsetX: Number(event.target.value) })}
                />
              </label>

              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={appearance.offsetY === null}
                  onChange={(event) => patch({ offsetY: event.target.checked ? null : 120 })}
                />
                Centre vertically
              </label>

              {appearance.offsetY !== null && (
                <label className="grid gap-1 text-xs">
                  <span className="text-muted-foreground">Distance from the top</span>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    className="border-border bg-background min-h-9 rounded border px-2 py-1.5 text-sm"
                    value={appearance.offsetY}
                    onChange={(event) => patch({ offsetY: Number(event.target.value) })}
                  />
                </label>
              )}
            </>
          )}

          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">
              Size — {Math.round(appearance.scale * 100)}%
            </span>
            <input
              type="range"
              min={0.4}
              max={2.5}
              step={0.05}
              value={appearance.scale}
              onChange={(event) => patch({ scale: Number(event.target.value) })}
            />
          </label>
        </div>
        <p className="text-muted-foreground text-xs">
          {supportsAnchorOffset
            ? 'Distances are in 1080p pixels. They mean the same thing at 1440p and 4K — the overlay scales with the canvas.'
            : 'Canvas placement is anchored automatically for this overlay type; Size adjusts its overall broadcast scale.'}
        </p>
      </section>

      <section className="grid gap-3">
        <h3 className="text-sm font-medium">
          {supportsMaxTeams ? 'Typography & rows' : 'Typography'}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">Font</span>
            <select
              className="border-border bg-background min-h-9 rounded border px-2 py-1.5 text-sm"
              value={appearance.fontFamily}
              onChange={(event) => patch({ fontFamily: event.target.value })}
            >
              <optgroup label="Built in">
                {FONT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
              {customFonts.length > 0 && (
                <optgroup label="Your fonts">
                  {customFonts.map((font) => (
                    <option key={font.family} value={fontFamilyValue(font.family)}>
                      {font.family}
                    </option>
                  ))}
                </optgroup>
              )}
              {!FONT_OPTIONS.some((option) => option.value === appearance.fontFamily) &&
                !customFonts.some(
                  (font) => fontFamilyValue(font.family) === appearance.fontFamily,
                ) && (
                  <option value={appearance.fontFamily}>
                    {appearance.fontFamily.split(',')[0]?.replace(/'/g, '')} (missing)
                  </option>
                )}
            </select>
          </label>

          {supportsMaxTeams && (
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Teams shown</span>
              <input
                type="number"
                min={1}
                max={25}
                className="border-border bg-background min-h-9 rounded border px-2 py-1.5 text-sm"
                value={appearance.maxTeams}
                onChange={(event) => patch({ maxTeams: Number(event.target.value) })}
              />
            </label>
          )}
        </div>
      </section>

      {instanceType === 'leaderboard' && (
        <TeamNameSettings
          appearance={appearance}
          patch={patch}
          onValidityChange={onValidityChange}
        />
      )}

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium">Panel &amp; championship palette</h3>
            <p className="text-muted-foreground text-xs">
              These sit over live video, so their opacity matters as much as their colour.
            </p>
          </div>
          <button
            type="button"
            onClick={() => patch({ colors: { ...PMCC_2026_OVERLAY_COLORS } })}
            className="border-border hover:bg-secondary min-h-8 shrink-0 rounded border px-2.5 py-1 text-xs font-medium text-[var(--brand-gold)] transition-colors"
            title="Apply the PMCC 2026 Championship Gold & Mahogany palette to this instance"
          >
            Apply PMCC 2026 Theme
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ColorField
            label="Background"
            hint="Primary panel surface"
            value={appearance.colors.background}
            allowAlpha
            onChange={(value) => patchColor('background', value)}
          />
          <ColorField
            label="Header background"
            hint="Behind headers and callout bars"
            value={appearance.colors.headerBackground}
            allowAlpha
            onChange={(value) => patchColor('headerBackground', value)}
          />
          <ColorField
            label="Row stripe"
            hint="Alternating row or secondary badge surface"
            value={appearance.colors.rowAltBackground}
            allowAlpha
            onChange={(value) => patchColor('rowAltBackground', value)}
          />
          <ColorField
            label="Accent"
            hint="Championship gold highlights, borders and ranks"
            value={appearance.colors.accent}
            allowAlpha
            onChange={(value) => patchColor('accent', value)}
          />
        </div>
      </section>

      <section className="grid gap-3">
        <h3 className="text-sm font-medium">
          {supportsPlayerColors ? 'Players and text colours' : 'Text colours'}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {supportsPlayerColors && (
            <>
              <ColorField
                label="Alive"
                hint="Health bar for a player still up"
                value={appearance.colors.playerAlive}
                onChange={(value) => patchColor('playerAlive', value)}
              />
              <ColorField
                label="Knocked"
                hint="Downed but revivable"
                value={appearance.colors.playerKnocked}
                onChange={(value) => patchColor('playerKnocked', value)}
              />
              <ColorField
                label="Eliminated"
                value={appearance.colors.playerDead}
                onChange={(value) => patchColor('playerDead', value)}
              />
            </>
          )}
          <ColorField
            label="Text"
            value={appearance.colors.text}
            onChange={(value) => patchColor('text', value)}
          />
          <ColorField
            label="Muted text"
            hint="Secondary labels and headers"
            value={appearance.colors.textMuted}
            onChange={(value) => patchColor('textMuted', value)}
          />
        </div>
      </section>

      {supportsBackgroundMedia && (
        <section className="grid gap-3">
          <div>
            <h3 className="text-sm font-medium">
              {instanceType === 'wwcd-fullscreen'
                ? 'Custom stage background media'
                : 'Post-game standings background'}
            </h3>
            <p className="text-muted-foreground text-xs">
              Optional full-canvas image or looping video behind this overlay instance. Leave
              Disabled for a transparent OBS canvas (or default stage backdrop on Fullscreen WWCD).
            </p>
          </div>

          <div className="border-border bg-secondary/15 grid gap-3 rounded border p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">Background mode</span>
                <select
                  aria-label="Post-game background mode"
                  className="border-border bg-background min-h-9 rounded border px-2 py-1.5 text-sm"
                  value={postGameBg.mode}
                  onChange={(event) =>
                    patchPostGameBg({ mode: event.target.value as PostGameBackgroundMode })
                  }
                >
                  <option value="disabled">Disabled (Transparent OBS canvas)</option>
                  <option value="image">Image (PNG / JPEG / WebP)</option>
                  <option value="video">Looping Video (MP4 / WebM)</option>
                </select>
              </label>

              <div className="grid gap-1 text-xs">
                <span className="text-muted-foreground">Background asset</span>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (!file || !onUploadBackground) return;
                      setUploadingBg(true);
                      try {
                        await onUploadBackground(file);
                      } finally {
                        setUploadingBg(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={!onUploadBackground || uploadingBg}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-border hover:bg-secondary min-h-9 rounded border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                  >
                    {uploadingBg
                      ? 'Uploading…'
                      : postGameBg.mediaUrl
                        ? 'Replace image / video'
                        : 'Upload image / video'}
                  </button>
                  {postGameBg.mediaUrl && onRemoveBackground && (
                    <button
                      type="button"
                      disabled={uploadingBg}
                      onClick={async () => {
                        setUploadingBg(true);
                        try {
                          await onRemoveBackground();
                        } finally {
                          setUploadingBg(false);
                        }
                      }}
                      className="border-border hover:bg-secondary text-destructive min-h-9 rounded border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {postGameBg.mediaUrl ? (
                  <span className="text-muted-foreground truncate font-mono text-[11px]">
                    Active: {postGameBg.mediaUrl.split('?')[0]}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-[11px]">
                    No custom background uploaded yet (max 32 MB).
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">
                  Media opacity &mdash; {postGameBg.opacity}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={postGameBg.opacity}
                  onChange={(event) => patchPostGameBg({ opacity: Number(event.target.value) })}
                />
              </label>

              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">
                  Background blur &mdash; {postGameBg.blur} px
                </span>
                <input
                  type="range"
                  min={0}
                  max={24}
                  step={1}
                  value={postGameBg.blur}
                  onChange={(event) => patchPostGameBg({ blur: Number(event.target.value) })}
                />
              </label>
            </div>
          </div>
        </section>
      )}

      {supportsShowHideAnimation && (
        <section className="grid gap-3">
          <h3 className="text-sm font-medium">Show / hide animation</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Type</span>
              <select
                className="border-border bg-background min-h-9 rounded border px-2 py-1.5 text-sm"
                value={animation.type}
                onChange={(event) =>
                  patchAnimation({ type: event.target.value as OverlayAnimationType })
                }
              >
                <option value="fade">Fade</option>
                <option value="wipe">Wipe &mdash; revealed from an edge, panel stays put</option>
                <option value="slide">Slide &mdash; the panel travels in</option>
                <option value="zoom-fade">Zoom</option>
              </select>
            </label>

            {hasDirection ? (
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">From</span>
                <select
                  className="border-border bg-background min-h-9 rounded border px-2 py-1.5 text-sm"
                  value={animation.direction}
                  onChange={(event) =>
                    patchAnimation({ direction: event.target.value as OverlayAnimationDirection })
                  }
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                </select>
              </label>
            ) : (
              <span className="hidden sm:block" />
            )}

            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Easing</span>
              <select
                className="border-border bg-background min-h-9 rounded border px-2 py-1.5 text-sm"
                value={animation.easing}
                onChange={(event) =>
                  patchAnimation({ easing: event.target.value as OverlayAnimation['easing'] })
                }
              >
                <option value="smooth">Smooth</option>
                <option value="snappy">Snappy</option>
                <option value="linear">Linear</option>
              </select>
            </label>

            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">
                Duration &mdash; {animation.durationMs} ms
              </span>
              <input
                type="range"
                min={100}
                max={5000}
                step={50}
                value={animation.durationMs}
                onChange={(event) => patchAnimation({ durationMs: Number(event.target.value) })}
              />
            </label>

            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={animation.withFade}
                disabled={animation.type === 'fade'}
                onChange={(event) => patchAnimation({ withFade: event.target.checked })}
              />
              Cross-fade as well
              <span className="text-muted-foreground text-xs">{fadeHint}</span>
            </label>
          </div>
        </section>
      )}

      {supportsRowStagger && (
        <section className="grid gap-3">
          <div>
            <h3 className="text-sm font-medium">Rows</h3>
            <p className="text-muted-foreground text-xs">
              Once the panel has arrived, the rows can fade in one after another. They hold their
              place from the start, so the panel does not resize while they fill in.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={animation.rows.enabled}
              onChange={(event) => patchRows({ enabled: event.target.checked })}
            />
            Bring the rows in one by one
          </label>

          {animation.rows.enabled && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">
                  Gap between rows &mdash; {animation.rows.staggerMs} ms
                </span>
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={5}
                  value={animation.rows.staggerMs}
                  onChange={(event) => patchRows({ staggerMs: Number(event.target.value) })}
                />
                <span className="text-muted-foreground">
                  {appearance.maxTeams} rows fill in over {rowSweepSeconds} s
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={animation.rows.reverseOnHide}
                  onChange={(event) => patchRows({ reverseOnHide: event.target.checked })}
                />
                <span>
                  Reverse it on the way out
                  <span className="text-muted-foreground block text-xs">
                    Off, the rows leave with the panel and the graphic clears at once. On, clearing
                    takes a further {rowSweepSeconds} s.
                  </span>
                </span>
              </label>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
