import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type {
  ManualMatchDocument,
  ManualTeamPatch,
  ManualTeamState,
  OperatingMode,
  Team,
  TeamRosterEntry,
} from '@cdf/shared';
import {
  createDefaultManualMatchDocument,
  createDefaultManualTeamState,
  DEFAULT_TEAM_ROSTER,
  manualMatchDocumentSchema,
} from '@cdf/shared';
import type { IngestPlayer, IngestUpdate } from '../ingest/source.js';
import { JsonDocument } from '../persistence/json-document.js';
import { migrateSchemaVersionOnly } from '../persistence/migrations.js';

export interface ManualStoreOptions {
  dataDir: string;
  roster?: readonly TeamRosterEntry[];
  defaultMode?: OperatingMode;
  onWarn?: (message: string, detail: unknown) => void;
}

export interface ResetManualMatchOptions {
  /** Optional live teams from the automatic source to seed a mid-match failover. */
  seedFromTeams?: readonly Team[];
}

const PLAYERS_PER_TEAM = 4;

/**
 * Reconciles the stored per-team manual list against the operator's current roster.
 *
 * Existing teams keep their manual progress (`aliveCount`, `eliminations`, `eliminatedSeq`,
 * `placementOverride`); newly added roster slots start at default (`4` alive, `0` elims); removed
 * roster slots are dropped so the manual state never drifts from `team-roster.json`.
 */
function reconcileTeamsWithRoster(
  existing: readonly ManualTeamState[],
  roster: readonly TeamRosterEntry[],
): ManualTeamState[] {
  const byTeamNo = new Map(existing.map((team) => [team.teamNo, team]));
  return [...roster]
    .sort((a, b) => a.teamNo - b.teamNo)
    .map((entry) => byTeamNo.get(entry.teamNo) ?? createDefaultManualTeamState(entry.teamNo));
}

function assertUniquePlacementOverrides(teams: readonly ManualTeamState[]): void {
  const seen = new Set<number>();
  for (const team of teams) {
    if (!team.present || team.placementOverride === null) continue;
    if (seen.has(team.placementOverride)) {
      throw new Error(
        `Two participating teams cannot share the same placement override (#${team.placementOverride}).`,
      );
    }
    seen.add(team.placementOverride);
  }
}

/**
 * Owns the persisted manual match state (`backend/data/manual-match.json`) and its projection into
 * the normalised `IngestUpdate` shape that `MatchStore` consumes (ADR-0004, ADR-0006).
 *
 * Unlike `PcobSource`, where `eliminationOrder` is append-only because the game never resurrects a
 * wiped squad, a human operator can click `0` alive on the wrong row and immediately undo it.
 * Elimination ordering is therefore tracked via a reversible `eliminatedSeq` per team and resolved
 * into `IngestPlayer.rank` on every edit.
 */
export class ManualStore {
  private readonly document: JsonDocument<ManualMatchDocument>;
  private roster: readonly TeamRosterEntry[];
  private mutationQueue: Promise<unknown> = Promise.resolve();

  constructor(options: ManualStoreOptions) {
    this.roster = options.roster ?? DEFAULT_TEAM_ROSTER.teams;
    const defaultMode = options.defaultMode ?? 'auto';

    this.document = new JsonDocument({
      filePath: path.join(options.dataDir, 'manual-match.json'),
      schema: manualMatchDocumentSchema,
      createDefault: () =>
        createDefaultManualMatchDocument(`manual-${randomUUID()}`, this.roster, defaultMode),
      migrate: migrateSchemaVersionOnly,
      onWarn: options.onWarn,
    });
  }

  async load(): Promise<ManualMatchDocument> {
    const loaded = await this.document.load();
    const reconciled = reconcileTeamsWithRoster(loaded.teams, this.roster);
    if (JSON.stringify(reconciled) !== JSON.stringify(loaded.teams)) {
      return this.document.write({ ...loaded, teams: reconciled });
    }
    return loaded;
  }

  getState(): ManualMatchDocument {
    return this.document.current;
  }

  getMode(): OperatingMode {
    return this.document.current.mode;
  }

  setMode(mode: OperatingMode): Promise<ManualMatchDocument> {
    return this.mutate(async () => {
      const current = this.document.current;
      if (current.mode === mode) return current;
      return this.document.write({ ...current, mode });
    });
  }

  /**
   * Replaces the manual match state entirely, used by backup restore.
   */
  replaceState(document: ManualMatchDocument): Promise<ManualMatchDocument> {
    return this.mutate(async () => {
      assertUniquePlacementOverrides(document.teams);
      return this.document.write(document);
    });
  }

  /**
   * Called when the operator saves a new team roster on the Teams tab or imports an INI file.
   */
  syncRoster(roster: readonly TeamRosterEntry[]): Promise<ManualMatchDocument> {
    return this.mutate(async () => {
      this.roster = roster;
      const current = this.document.current;
      const teams = reconcileTeamsWithRoster(current.teams, roster);
      return this.document.write({ ...current, teams });
    });
  }

  /**
   * Fast single-team update used by the 1-click controls on the Manual control page.
   */
  patchTeam(teamNo: number, patch: ManualTeamPatch): Promise<ManualMatchDocument> {
    return this.mutate(async () => {
      const current = this.document.current;
      const target = current.teams.find((team) => team.teamNo === teamNo);
      if (!target) {
        throw new Error(`Team #${teamNo} is not in the configured roster.`);
      }

      let nextEliminatedSeq = current.nextEliminatedSeq;
      const updated = applyPatchToTeam(target, patch, () => nextEliminatedSeq++);

      const teams = current.teams.map((team) => (team.teamNo === teamNo ? updated : team));
      assertUniquePlacementOverrides(teams);

      return this.document.write({
        ...current,
        nextEliminatedSeq,
        teams,
      });
    });
  }

  /**
   * Bulk update across multiple teams at once.
   */
  updateTeams(
    updates: readonly ({ teamNo: number } & ManualTeamPatch)[],
  ): Promise<ManualMatchDocument> {
    return this.mutate(async () => {
      const seenTeamNos = new Set<number>();
      for (const entry of updates) {
        if (seenTeamNos.has(entry.teamNo)) {
          throw new Error(`Team #${entry.teamNo} appears more than once in the update.`);
        }
        seenTeamNos.add(entry.teamNo);
      }

      const current = this.document.current;
      const currentByNo = new Map(current.teams.map((team) => [team.teamNo, team]));
      for (const entry of updates) {
        if (!currentByNo.has(entry.teamNo)) {
          throw new Error(`Team #${entry.teamNo} is not in the configured roster.`);
        }
      }

      let nextEliminatedSeq = current.nextEliminatedSeq;
      const patchByNo = new Map(updates.map((entry) => [entry.teamNo, entry]));

      const teams = current.teams.map((team) => {
        const patch = patchByNo.get(team.teamNo);
        if (!patch) return team;
        return applyPatchToTeam(team, patch, () => nextEliminatedSeq++);
      });

      assertUniquePlacementOverrides(teams);

      return this.document.write({
        ...current,
        nextEliminatedSeq,
        teams,
      });
    });
  }

  /**
   * Resets the manual match for a new map (fresh `matchId`, all teams back to 4 alive and 0 elims),
   * or seeds it from the automatic source's current standings for mid-match failover.
   */
  resetMatch(options: ResetManualMatchOptions = {}): Promise<ManualMatchDocument> {
    return this.mutate(async () => {
      const current = this.document.current;
      const matchId = `manual-${randomUUID()}`;

      if (!options.seedFromTeams || options.seedFromTeams.length === 0) {
        const fresh = createDefaultManualMatchDocument(matchId, this.roster, current.mode);
        return this.document.write(fresh);
      }

      const seededByNo = new Map(options.seedFromTeams.map((team) => [team.teamNo, team]));
      const sortedRoster = [...this.roster].sort((a, b) => a.teamNo - b.teamNo);

      // Eliminated teams in the source projection are ordered worst-placement-first so their
      // `eliminatedSeq` reproduces the exact elimination order they had in PCOB.
      const eliminatedOrder = options.seedFromTeams
        .filter((team) => team.hasAppeared && (team.isEliminated || team.standingPlayerCount === 0))
        .slice()
        .sort(
          (a, b) =>
            (b.placement ?? Number.MAX_SAFE_INTEGER) - (a.placement ?? Number.MAX_SAFE_INTEGER) ||
            a.teamNo - b.teamNo,
        );
      const seqByTeamNo = new Map<number, number>();
      eliminatedOrder.forEach((team, index) => {
        seqByTeamNo.set(team.teamNo, index + 1);
      });

      const teams: ManualTeamState[] = sortedRoster.map((entry) => {
        const sourceTeam = seededByNo.get(entry.teamNo);
        if (!sourceTeam || !sourceTeam.hasAppeared) {
          return {
            teamNo: entry.teamNo,
            present: false,
            aliveCount: 4,
            eliminations: 0,
            eliminatedSeq: null,
            placementOverride: null,
          };
        }

        const aliveCount = sourceTeam.isEliminated
          ? 0
          : Math.max(1, Math.min(PLAYERS_PER_TEAM, sourceTeam.standingPlayerCount));

        return {
          teamNo: entry.teamNo,
          present: true,
          aliveCount,
          eliminations: Math.max(0, sourceTeam.eliminations),
          eliminatedSeq: aliveCount === 0 ? (seqByTeamNo.get(entry.teamNo) ?? 1) : null,
          placementOverride: null,
        };
      });

      return this.document.write({
        ...current,
        matchId,
        nextEliminatedSeq: eliminatedOrder.length + 1,
        teams,
      });
    });
  }

  /**
   * Builds the normalised `IngestUpdate` for `MatchStore`.
   *
   * Key invariants:
   * - Non-participating teams (`present: false`) emit no players, so `MatchStore` marks them
   *   `hasAppeared: false` (dimmed to 25 % on the overlay and sorted last).
   * - Participating teams always emit all 4 player slots (`1..4`). Slots `1..aliveCount` are
   *   `alive` at full health (`100/100`); slots `aliveCount+1..4` are `dead` at `0/100`. Passing
   *   all 4 slots explicitly prevents `AlivePlayerBars` from treating missing slots as `unknown`
   *   (which would render full-height bars).
   * - Team eliminations are carried on slot 1 (`computeStandings` sums `player.kills` across the
   *   team, and individual player kills are never rendered).
   * - Placements for eliminated or overridden teams are passed via `player.rank` so `MatchStore`
   *   trusts them directly while leaving surviving teams at `rank: 0` ("still playing").
   */
  toIngestUpdate(roster: readonly TeamRosterEntry[] = this.roster): IngestUpdate {
    const state = this.document.current;
    const rosterByNo = new Map(roster.map((entry) => [entry.teamNo, entry]));

    const presentTeams = state.teams.filter((team) => team.present && rosterByNo.has(team.teamNo));
    const placements = resolveManualPlacements(presentTeams);

    const players: IngestPlayer[] = [];
    for (const team of presentTeams) {
      const rosterEntry = rosterByNo.get(team.teamNo);
      if (!rosterEntry) continue;

      const rank = placements.get(team.teamNo) ?? 0;

      for (let slot = 1; slot <= PLAYERS_PER_TEAM; slot += 1) {
        const isAlive = slot <= team.aliveCount;
        players.push({
          id: `manual-${team.teamNo}-${slot}`,
          name: `${rosterEntry.name}_${slot}`,
          teamNo: team.teamNo,
          slot,
          liveState: isAlive ? 'alive' : 'dead',
          health: isAlive ? 100 : 0,
          healthMax: 100,
          kills: slot === 1 ? team.eliminations : 0,
          rank,
        });
      }
    }

    return {
      matchId: state.matchId,
      phase: 'live',
      players,
      inWarmup: false,
    };
  }

  private mutate<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.mutationQueue.then(fn, fn);
    this.mutationQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

function applyPatchToTeam(
  current: ManualTeamState,
  patch: ManualTeamPatch,
  allocateSeq: () => number,
): ManualTeamState {
  const present = patch.present ?? current.present;
  const aliveCount = patch.aliveCount ?? current.aliveCount;
  const eliminations = patch.eliminations ?? current.eliminations;
  const placementOverride =
    patch.placementOverride !== undefined ? patch.placementOverride : current.placementOverride;

  if (!present) {
    return {
      teamNo: current.teamNo,
      present: false,
      aliveCount,
      eliminations,
      eliminatedSeq: null,
      placementOverride: null,
    };
  }

  let eliminatedSeq = current.eliminatedSeq;
  if (aliveCount === 0) {
    eliminatedSeq ??= allocateSeq();
  } else {
    eliminatedSeq = null;
  }

  return {
    teamNo: current.teamNo,
    present: true,
    aliveCount,
    eliminations,
    eliminatedSeq,
    placementOverride,
  };
}

/**
 * Resolves 1-based placements for participating manual teams that have either an explicit
 * `placementOverride` or `aliveCount === 0`.
 *
 * Uses the same single-pool principle as `MatchStore.resolvePlacements`: explicit overrides claim
 * their slots first, and remaining eliminated teams (ordered by `eliminatedSeq` ascending, earliest
 * wiped first) draw from the worst unclaimed slots downward (`totalPresent`, `totalPresent - 1`, …).
 */
export function resolveManualPlacements(
  presentTeams: readonly ManualTeamState[],
): ReadonlyMap<number, number> {
  const placements = new Map<number, number>();
  const totalPresent = presentTeams.length;
  if (totalPresent === 0) return placements;

  const claimed = new Set<number>();
  for (const team of presentTeams) {
    if (team.placementOverride !== null) {
      placements.set(team.teamNo, team.placementOverride);
      claimed.add(team.placementOverride);
    }
  }

  const available: number[] = [];
  for (let slot = totalPresent; slot >= 1; slot -= 1) {
    if (!claimed.has(slot)) available.push(slot);
  }

  const wipedWithoutOverride = presentTeams
    .filter((team) => team.aliveCount === 0 && !placements.has(team.teamNo))
    .slice()
    .sort(
      (a, b) =>
        (a.eliminatedSeq ?? Number.MAX_SAFE_INTEGER) -
          (b.eliminatedSeq ?? Number.MAX_SAFE_INTEGER) || a.teamNo - b.teamNo,
    );

  for (const team of wipedWithoutOverride) {
    const slot = available.shift();
    if (slot === undefined) break;
    placements.set(team.teamNo, slot);
  }

  return placements;
}
