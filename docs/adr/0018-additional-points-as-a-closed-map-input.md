# ADR-0018: Additional points are an independent closed-map input, applied once

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Operator (Part 8 approval), with analysis by Claude
- **Supersedes / Superseded by:** — (refines ADR-0015's "never a direct points override" rule)

## Context

Tournament administrators need to apply a discretionary bonus or penalty to one team for one map —
for example a 2-point "Warning" deduction (PGS Tournament Rulebook §8; PUBG Esports ruling on
17Gaming & Tianba, 2024-12-16). ADR-0015 accepts only `placement`/`eliminations` when a closed map is
corrected: points are always re-derived from the scoring ruleset and never accepted as an override.
That rule must survive, because a stored total that people edit directly is exactly what lets a
recalculation double-count or drift.

Two schema facts also stood in the way. `ClosedMapTeamResult.totalPoints` and the live
`Team.totalPoints` were both `.min(0)`, and a snapshot that fails validation is silently dropped by
every overlay, which freezes the overlay on air.

## Decision

- **`additionalPoints` is a fourth raw input on each closed-map team result**, alongside `placement`
  and `eliminations`. It is a whole number from −100 to +100. The re-derivation is
  `totalPoints = killPoints + placementPoints + additionalPoints`, rebuilt from the inputs on every
  save. Replaying a save is idempotent, and nothing ever adds to a previous total.
- **The official `killPoints` and `placementPoints` never include the adjustment.** Tie-breakers
  (WWCD, Σ placement points, Σ kill points, latest placement, slot) and audits keep reading the
  ruleset values. Only the total moves.
- **The adjustment is optional on the wire and on disk.** A map written before this ADR reads as
  "no adjustment" (`additionalPointsOf()` → 0) with its stored total untouched. There is no migration
  and no `CONFIG_SCHEMA_VERSION` bump (see ADR-0015 on why that shared number is not bumped for one
  document).
- **On a correction, an omitted adjustment keeps the stored value; an explicit `0` clears it.** An
  admin tab loaded before the upgrade, or any client that does not know the field, cannot silently
  erase a penalty.
- **The audit trail is lightweight.** Each team result can carry an optional `adjustmentNote`
  (≤ 120 characters) and `adjustedAt`, the time of the last change to the value or the note. The
  backend logs one `series.additionalPoints` line per change, with the map, team, old and new values
  and the reason. There is no operator identity, because the admin has no authentication (ADR-0008).
- **Totals are signed.** Both `totalPoints` schemas drop `.min(0)`. A penalty larger than a team's
  points takes its map total, series total and live PTS below zero, unclamped. `PROTOCOL_VERSION`
  goes from 10 to 11, so a stale browser source shows the existing "out of date — reload" notice
  instead of dropping snapshots.
- **Live closes record no adjustment.** Adjustments are entered only through Correct This Map or
  Add map by hand. Live PTS banking nets only the official kill and placement points, so a
  still-displayed, just-closed match counts its adjustment exactly once, through the series total.
- **The official Excel workbook stays official-only.** It has no adjustment column. Export keeps the
  placement + kill formulas and warns, in the admin and via the `x-cdf-omitted-adjustments` header,
  which adjustments it leaves out. An import that replaces the match history warns, in the preview
  and in the result, which recorded adjustments it resets to 0.

## Consequences

### Positive

- One stored total keeps feeding every existing consumer unchanged: series totals, live PTS,
  postgame, WWCD and the admin cards. The adjustment is still visible on its own for the ADJ columns
  and for audits.
- Backup v2 round-trips the new fields with no format change, and old backups restore as unadjusted.

### Negative / costs accepted

- The Excel workbook's totals and ranks differ from the broadcast while adjustments exist. This is
  surfaced, not hidden.
- An older app version that loads a newer `series.json` or backup drops the fields (zod strips
  unknown keys). This is documented for operators.

## Alternatives considered

- **Floor map totals at 0.** Rejected: it would silently drop part of a large penalty.
- **Store the adjustment by editing `totalPoints`.** Rejected: re-derivation would erase it, or a
  second edit would compound it.
- **Embed adjustments in the Excel formulas.** Not chosen by the operator (Part 8, Q12). They chose
  official-only export plus explicit warnings.
