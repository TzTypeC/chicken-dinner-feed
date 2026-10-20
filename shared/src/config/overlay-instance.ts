import { z } from 'zod';
import { CONFIG_SCHEMA_VERSION } from '../versions.js';

/**
 * Colours an operator can change.
 *
 * Every one of these becomes a CSS custom property on the overlay root at render time, which is why
 * they are stored as plain CSS colour strings rather than a structured colour type: the admin writes
 * a value, the browser applies it, and nothing has to re-render (ADR-0003).
 */
export const overlayColorsSchema = z.object({
  background: z.string().min(1),
  headerBackground: z.string().min(1),
  rowAltBackground: z.string().min(1),
  text: z.string().min(1),
  textMuted: z.string().min(1),
  accent: z.string().min(1),
  playerAlive: z.string().min(1),
  playerKnocked: z.string().min(1),
  playerDead: z.string().min(1),
});
export type OverlayColors = z.infer<typeof overlayColorsSchema>;

/**
 * How the overlay arrives and leaves.
 *
 * `type` is what the motion *is*; `direction` is only meaningful for the two types that have one.
 * Keeping them separate rather than flattening into a single list of "slide-left, slide-right,
 * wipe-left…" means adding a type later does not multiply the options by four.
 */
export const overlayAnimationTypeSchema = z.enum(['fade', 'wipe', 'slide', 'zoom-fade']);
export type OverlayAnimationType = z.infer<typeof overlayAnimationTypeSchema>;

/** Which edge the motion comes from. Ignored by `fade` and `zoom-fade`. */
export const overlayAnimationDirectionSchema = z.enum(['top', 'bottom', 'left', 'right']);
export type OverlayAnimationDirection = z.infer<typeof overlayAnimationDirectionSchema>;

/**
 * Rows appearing one after another once the panel itself has arrived.
 *
 * The rows occupy their space from the start and only change opacity, so the panel does not resize
 * while they fill in — a growing panel would drag the layout around on air.
 */
export const overlayRowAnimationSchema = z.object({
  enabled: z.boolean(),
  /** Gap between consecutive rows. */
  staggerMs: z.number().int().min(10).max(500),
  /**
   * Whether hiding reverses the stagger.
   *
   * Off by default: when a director needs a graphic gone, it should go. Sixteen rows at 100 ms
   * would put more than a second between the key press and an empty screen.
   */
  reverseOnHide: z.boolean(),
});
export type OverlayRowAnimation = z.infer<typeof overlayRowAnimationSchema>;

export const overlayAnimationSchema = z.object({
  type: overlayAnimationTypeSchema,
  direction: overlayAnimationDirectionSchema,
  durationMs: z.number().int().min(100).max(5000),
  /**
   * Named rather than a raw cubic-bezier: an operator picking "smooth" or "snappy" before a
   * broadcast is making a judgement they can make, whereas four control points is a question they
   * cannot usefully answer.
   */
  easing: z.enum(['smooth', 'snappy', 'linear']),
  /**
   * Cross-fade on top of the chosen motion.
   *
   * Applies uniformly, including to `zoom-fade` — switching it off there leaves a pure zoom. One
   * rule for every type is easier to predict than a per-type exception.
   */
  withFade: z.boolean(),
  rows: overlayRowAnimationSchema,
});
export type OverlayAnimation = z.infer<typeof overlayAnimationSchema>;

/**
 * Where an uploaded post-game background lives. Only files the backend itself stored are accepted —
 * never an arbitrary URL — so a browser source can only ever be pointed at media that passed the
 * magic-byte check in `BackgroundStore` (docs/postgame-standings-requirements.md §3).
 */
export const BACKGROUND_MEDIA_URL_PATTERN =
  /^\/api\/backgrounds\/[a-z0-9][a-z0-9-]{0,31}\.(png|jpg|webp|mp4|webm)(\?v=\d+)?$/;

export const postGameBackgroundModeSchema = z.enum(['disabled', 'image', 'video']);
export type PostGameBackgroundMode = z.infer<typeof postGameBackgroundModeSchema>;

/**
 * Optional media behind the post-game standings screen (D-PMCC-05).
 *
 * Opacity and blur apply to the media layer only; the foreground standings are never blurred, and
 * with the mode disabled the canvas stays fully transparent for OBS compositing.
 */
export const postGameBackgroundSchema = z.object({
  mode: postGameBackgroundModeSchema.default('disabled'),
  mediaUrl: z.string().regex(BACKGROUND_MEDIA_URL_PATTERN).nullable().default(null),
  /** 0 (invisible) to 100 (fully opaque). */
  opacity: z.number().int().min(0).max(100).default(65),
  /** Gaussian blur radius in design-canvas pixels. */
  blur: z.number().int().min(0).max(24).default(4),
});
export type PostGameBackground = z.infer<typeof postGameBackgroundSchema>;

export const DEFAULT_POST_GAME_BACKGROUND: PostGameBackground = {
  mode: 'disabled',
  mediaUrl: null,
  opacity: 65,
  blur: 4,
};

/** The media kind a stored background URL refers to, judged from the extension the backend gave it. */
export function backgroundMediaKind(mediaUrl: string | null): 'image' | 'video' | null {
  if (!mediaUrl) return null;
  const match = BACKGROUND_MEDIA_URL_PATTERN.exec(mediaUrl);
  if (!match) return null;
  return match[1] === 'mp4' || match[1] === 'webm' ? 'video' : 'image';
}

export const overlayAppearanceSchema = z.object({
  /** Which edge the panel is pinned to. */
  anchor: z.enum(['left', 'right']),
  /** Distance from that edge, in design-canvas pixels (ADR-0011). */
  offsetX: z.number().int().min(0).max(1800),
  /** Distance from the top, in design-canvas pixels. Null means vertically centred. */
  offsetY: z.number().int().min(0).max(1000).nullable(),
  /** Operator size multiplier, applied on top of the resolution scale. */
  scale: z.number().min(0.4).max(2.5),

  fontFamily: z.string().min(1),
  colors: overlayColorsSchema,
  animation: overlayAnimationSchema,

  showLegend: z.boolean(),
  /** Whether team logos and the logo column are shown on the leaderboard and elimination alerts. */
  showLogos: z.boolean().default(true),
  /** Master switch for the Team Elimination Notification Overlay (/overlay/elimination). */
  showEliminationAlerts: z.boolean().default(true),
  /** Whether the eliminated team's match kill/elimination count is shown on the alert banner. */
  showEliminationAlertElims: z.boolean().default(true),
  /** Master switch for the Match Information Overlay (/overlay/match-info). */
  showMatchInfo: z.boolean().default(true),
  /** Whether the map name is shown alongside the match number on the Match Information Overlay. */
  showMatchInfoMapName: z.boolean().default(true),
  /** Whether the stable roster slot (`teamNo`, shown as T01–T25) appears beside each team name. */
  showTeamNumbers: z.boolean().default(true),
  /** Whether the leaderboard switches to the top-centre Final-4 bar once four teams remain. */
  showFinalFourLayout: z.boolean().default(true),
  /** Whether the leaderboard route switches to the WWCD screen once a single winner remains. */
  showWwcdOverlay: z.boolean().default(true),
  /** Media behind the post-game standings screen. */
  postGameBackground: postGameBackgroundSchema.default(DEFAULT_POST_GAME_BACKGROUND),
  /** Trim the table for formats with fewer than 25 teams. */
  maxTeams: z.number().int().min(1).max(25),
});
export type OverlayAppearance = z.infer<typeof overlayAppearanceSchema>;

/**
 * Instance ids appear in URLs — the browser-source address and the Companion button both use them —
 * so they are restricted to characters that survive both without escaping or ambiguity.
 */
export const overlayInstanceIdSchema = z
  .string()
  .regex(
    /^[a-z0-9][a-z0-9-]{0,31}$/,
    'Use 1–32 lowercase letters, digits or hyphens, starting with a letter or digit.',
  );

export const overlayInstanceSchema = z.object({
  id: overlayInstanceIdSchema,
  /** Operator-facing label. The id is what goes in URLs. */
  name: z.string().min(1).max(60),
  /**
   * Overlay type. A registry of one for now; deliberately not generalised until there are two to
   * generalise from.
   */
  type: z.literal('leaderboard'),
  appearance: overlayAppearanceSchema,
});
export type OverlayInstance = z.infer<typeof overlayInstanceSchema>;

export const overlayInstancesDocumentSchema = z.object({
  schemaVersion: z.number().int().min(1),
  instances: z.array(overlayInstanceSchema),
});
export type OverlayInstancesDocument = z.infer<typeof overlayInstancesDocumentSchema>;

/**
 * The factory palette every install shipped with before the PMCC 2026 theme (zinc + rose). Kept so
 * the v3 → v4 migration can recognise an instance nobody recoloured and move it to the new default,
 * while leaving any operator-chosen palette exactly as it was (decision D-PMCC-06 / A4).
 */
export const LEGACY_FACTORY_OVERLAY_COLORS: OverlayColors = {
  background: 'rgba(24, 24, 27, 0.82)',
  headerBackground: 'rgba(12, 12, 14, 0.92)',
  rowAltBackground: 'rgba(39, 39, 42, 0.55)',
  text: '#fafafa',
  textMuted: '#a1a1aa',
  accent: '#e11d48',
  playerAlive: '#ef2b2b',
  playerKnocked: '#f5a524',
  playerDead: '#52525b',
};

/**
 * PMCC 2026 palette, sampled from `assets/KV_2026 PMCC ID.png`
 * (docs/pmcc-visual-identity-analysis.md): espresso-obsidian surfaces, mahogany header, gunmetal
 * alternate rows, parchment-ivory text, champagne labels, nib-trophy gold accent, airdrop crimson
 * for knocked players.
 */
export const PMCC_2026_OVERLAY_COLORS: OverlayColors = {
  background: 'rgba(22, 15, 10, 0.88)',
  headerBackground: 'rgba(38, 24, 15, 0.95)',
  rowAltBackground: 'rgba(61, 54, 43, 0.35)',
  text: '#f9edd9',
  textMuted: '#c9b68e',
  accent: '#e5a93c',
  playerAlive: '#f9edd9',
  playerKnocked: '#c4462a',
  playerDead: '#4a4136',
};

/** Fresh installs start on the PMCC 2026 identity. */
export const DEFAULT_OVERLAY_APPEARANCE: OverlayAppearance = {
  anchor: 'left',
  offsetX: 24,
  offsetY: null,
  scale: 1,
  fontFamily: "'Inter', system-ui, sans-serif",
  colors: PMCC_2026_OVERLAY_COLORS,
  animation: {
    type: 'slide',
    direction: 'left',
    durationMs: 420,
    easing: 'smooth',
    withFade: true,
    rows: { enabled: false, staggerMs: 60, reverseOnHide: false },
  },
  showLegend: true,
  showLogos: true,
  showEliminationAlerts: true,
  showEliminationAlertElims: true,
  showMatchInfo: true,
  showMatchInfoMapName: true,
  showTeamNumbers: true,
  showFinalFourLayout: true,
  showWwcdOverlay: true,
  postGameBackground: DEFAULT_POST_GAME_BACKGROUND,
  maxTeams: 16,
};

export const DEFAULT_OVERLAY_INSTANCES: OverlayInstancesDocument = {
  schemaVersion: CONFIG_SCHEMA_VERSION,
  instances: [
    {
      id: 'main',
      name: 'Main leaderboard',
      type: 'leaderboard',
      appearance: DEFAULT_OVERLAY_APPEARANCE,
    },
  ],
};
