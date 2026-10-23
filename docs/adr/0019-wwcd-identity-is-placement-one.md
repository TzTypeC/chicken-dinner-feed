# ADR-0019: WWCD identity is the recorded placement #1, or a confirmed last-standing team — never inferred

- **Status:** Accepted
- **Date:** 2026-10-23
- **Deciders:** Operator (Part 9 approval, Revision 2), with analysis by Claude
- **Supersedes / Superseded by:** —

## Context

Before Part 9, the post-game match screen chose its "WINNER WINNER CHICKEN DINNER" team in three
different ways depending on the data: `placement === 1` on a closed map, otherwise the best
placement on that map, and — before a map was closed — a placement invented from the team's
position in the live table, followed by "the first row" (the highest scorer). The WWCD card used yet
another rule (the sole standing team, else the last closed map's best placement, with the slot's
_current_ roster name). In production this crowned a team with 11 eliminations that finished 2nd,
while the WWCD screens named the real survivor.

The PUBG MOBILE Official Competition Rulebook's first series tie-breaker is "total times of winning
the first placement": the chicken dinner _is_ placement #1. Closed-map placements are already
validated as unique. What was missing was one rule, applied everywhere, that never guesses.

## Decision

One pure resolver (`frontend/src/components/overlay/wwcd-resolver.ts`) is used by the post-game
match screen, the WWCD card, the fullscreen WWCD screen and the automatic WWCD layout trigger:

1. **Recorded map** (the map shown has been closed): the team with placement #1, if exactly one
   exists → `final`. Otherwise `final-invalid` ("WWCD not recorded"); nobody is promoted.
2. **Unclosed map**: exactly one appeared team that is positively standing (`standingPlayerCount >
0`), at least one team eliminated, **no** appeared team of unknown status (no players in this
   snapshot), and no conflicting live placement #1 → that team, `provisional`.
3. Anything else with teams out → `unconfirmed` ("WWCD not confirmed yet").
4. Points, rank, array order and `teamNo` are never used to pick a winner.

Provisional results are labelled on every surface (including points). The post-game `latest`
selection shows the current map once it is `provisional` or `unconfirmed`, and the recorded map
after it is closed. Historical identity comes from the closed map's snapshot (`name`, `logoUrl`).

No schema field (`wwcdTeamNo`) is added: it would be a second source of truth that could disagree
with an operator's placement correction.

## Consequences

- A provisional winner never changes at close: `projectAsEnded()` gives the sole survivor the best
  free slot, and the one case where it would not (a conflicting live placement #1) is already
  `unconfirmed`.
- Incomplete or contradictory data is shown as such on air rather than as a confident wrong winner.
- A closed map without #1 (allowed by edits, hand-added maps and Excel import) is flagged in the
  admin and the import preview; it is not rejected, so operators can still record partial data.
- No protocol or persisted-data change.
