# ADR-0020: The Final 4 WWCD estimate is the share of standing players (Model U), labelled as a model

- **Status:** Accepted
- **Date:** 2026-10-23
- **Deciders:** Operator (Part 10 approval), with analysis by Claude
- **Supersedes / Superseded by:** —

## Context

Part 10 adds an optional per-team WWCD percentage under the Final 4 cards. The audit
(`docs/part10-audit-and-proposal.md` §7) found **no historical data** to fit or calibrate a model:
live telemetry is memory-only (ADR-0004), the production series had 0 closed maps, and no PCOB time
series exists in the repository. Manual mode supplies only per-team standing counts and
eliminations; PCOB adds knocked state and health, which Manual cannot provide. Published live
win-probability models (Dota 2, CS:GO, LoL) rely on many features and large datasets.

## Decision

- **Model U:** `share_i = standing players of team i / Σ standing players` over the standing teams
  of the locked Final 4 cohort. It is exact under the stated assumption that each elimination removes
  a uniformly random standing player (the last survivor is then uniform over the current players),
  has no fitted parameters, gives 0 to wiped teams and equal shares to equal inputs, and works in
  Manual and PCOB alike. Knocked and disconnected players count as standing while the source has not
  eliminated them (same definition as the alive bars and the WWCD resolver, ADR-0019).
- Points and eliminations are **not** inputs: points do not affect survival, and using eliminations as
  strength would need calibration data that does not exist.
- Displayed integers come from the **largest remainder (Hamilton) method**, so they always sum to
  exactly 100; ties go to the larger raw value, then the lower `teamNo` (deterministic, no flicker).
- No number is shown when the data is unknown, conflicting, connecting, or when fewer than two teams
  stand; stale or disconnected data keeps the last values dimmed under a "DATA STALE" label. Nothing
  is redistributed silently. The estimate stops when the live WWCD resolves (the Final 4 hides).
- Labelled `WIN CHANCE · MODEL` with a one-line note on air: an estimate from players still standing,
  not a calibrated model. Off by default, per Final 4 instance (`showWwcdPrediction`).

## Consequences

- The figure is transparent and testable but **uncalibrated**; it ignores firepower, position and
  health. Equal teams can differ by one point after rounding (e.g. 37 / 36) — a property of exact-sum
  integer rounding.
- An empirical model needs a recorder of live states and outcomes (an ADR-0004 change) and evaluation
  with Brier score / log loss on match-grouped, time-ordered splits. Explicitly out of scope for Part 10;
  to be proposed separately.
- The Final 4 cards grow by 30 design px when enabled, so the elimination banner's Final-4 position
  moved to `ub(194)` (base units, independent of the banner's own scale).
