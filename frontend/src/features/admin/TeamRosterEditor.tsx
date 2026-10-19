import type { TeamRosterDocument, TeamRosterEntry } from '@cdf/shared';
import { TeamLogoCell } from './TeamLogoCell';

export interface TeamRosterEditorProps {
  document: TeamRosterDocument;
  onChange(document: TeamRosterDocument): void;
}

/**
 * Team names, keyed by PCOB team number.
 *
 * The team number is not editable in place: it is the join key to the live data
 * (specs/PCOB-FINDINGS.md §3), so changing it silently re-points a row at a different squad. Adding
 * and removing rows is how the roster changes shape.
 *
 * There is exactly one name field, not a long one plus a derived short one — matching the ini,
 * which only ever has a single `TeamName=` value per team.
 */
export function TeamRosterEditor({ document, onChange }: TeamRosterEditorProps) {
  const patch = (teamNo: number, changes: Partial<TeamRosterEntry>) =>
    onChange({
      ...document,
      teams: document.teams.map((team) =>
        team.teamNo === teamNo ? { ...team, ...changes } : team,
      ),
    });

  const nextFreeTeamNo = (): number => {
    const used = new Set(document.teams.map((team) => team.teamNo));
    for (let candidate = 1; candidate <= 25; candidate += 1) {
      if (!used.has(candidate)) return candidate;
    }
    return 25;
  };

  return (
    <div className="grid gap-3">
      <p className="text-muted-foreground text-xs">
        The number is the slot the game reports, matching your <code>TeamLogoAndColor.ini</code>.
        The name is what the overlay prints. Logos upload as soon as you pick them — the rest of the
        row needs <strong>Save teams</strong>. Importing an ini replaces this whole list.
      </p>

      <div className="grid gap-2">
        {[...document.teams]
          .sort((a, b) => a.teamNo - b.teamNo)
          .map((team) => (
            <div
              key={team.teamNo}
              className="grid grid-cols-[2rem_3.75rem_minmax(0,1fr)_2.25rem] items-center gap-1.5 sm:grid-cols-[2.5rem_4.5rem_minmax(0,1fr)_2.25rem] sm:gap-2"
            >
              <span className="text-muted-foreground text-center text-sm tabular-nums">
                {team.teamNo}
              </span>
              <TeamLogoCell
                team={team}
                onChange={(updated) =>
                  onChange({
                    ...document,
                    teams: document.teams.map((entry) =>
                      entry.teamNo === updated.teamNo ? updated : entry,
                    ),
                  })
                }
              />
              <input
                type="text"
                aria-label={`Team ${team.teamNo} name`}
                maxLength={24}
                className="border-border bg-background min-h-9 min-w-0 rounded border px-2 py-1.5 text-sm font-semibold"
                value={team.name}
                onChange={(event) => patch(team.teamNo, { name: event.target.value })}
              />
              <button
                type="button"
                aria-label={`Remove team ${team.teamNo}`}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 grid min-h-9 min-w-9 place-items-center rounded text-base"
                onClick={() =>
                  onChange({
                    ...document,
                    teams: document.teams.filter((entry) => entry.teamNo !== team.teamNo),
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
      </div>

      <button
        type="button"
        className="border-border hover:bg-secondary min-h-9 w-fit rounded border px-3 py-1.5 text-xs disabled:opacity-40"
        disabled={document.teams.length >= 25}
        onClick={() => {
          const teamNo = nextFreeTeamNo();
          onChange({
            ...document,
            teams: [...document.teams, { teamNo, name: `T${teamNo}`, logoUrl: null }],
          });
        }}
      >
        Add a team
      </button>
    </div>
  );
}
