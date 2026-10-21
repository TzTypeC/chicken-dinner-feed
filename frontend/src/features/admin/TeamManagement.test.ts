import { describe, expect, it } from 'vitest';
import type { TeamRosterEntry } from '@cdf/shared';
import { parseBulkTeamLines } from './bulk-teams';
import { applyDirectSwap, applyRippleShift } from './roster-reorder';

describe('BulkTeamDialog - parseBulkTeamLines', () => {
  it('parses valid lines with explicit slots, CSV commas, T prefixes, and auto slots', () => {
    const raw = `
      1 Alpha Team
      2, Bravo Gaming
      T03 Charlie Esports
      Delta Squad
    `;
    const existingSlots = new Set<number>();
    const result = parseBulkTeamLines(raw, existingSlots, 25, 0);

    expect(result.canCommit).toBe(true);
    expect(result.errorMessage).toBeNull();
    expect(result.validTeams).toEqual([
      { teamNo: 1, name: 'Alpha Team' },
      { teamNo: 2, name: 'Bravo Gaming' },
      { teamNo: 3, name: 'Charlie Esports' },
      { teamNo: 4, name: 'Delta Squad' }, // auto-assigned lowest free slot
    ]);
  });

  it('rejects duplicate slots in the same bulk input batch', () => {
    const raw = `
      1 Alpha
      1 Duplicate Slot
    `;
    const result = parseBulkTeamLines(raw, new Set(), 25, 0);
    expect(result.canCommit).toBe(false);
    expect(result.rows[1]?.error).toContain('Duplicate slot 1');
  });

  it('rejects slots already occupied in active roster', () => {
    const raw = `
      5 New Team
    `;
    const existingSlots = new Set([5]);
    const result = parseBulkTeamLines(raw, existingSlots, 25, 1);
    expect(result.canCommit).toBe(false);
    expect(result.rows[0]?.error).toContain('already occupied');
  });

  it('rejects slots outside 1–25 range', () => {
    const raw = `
      0 Zero Team
      26 Over Team
    `;
    const result = parseBulkTeamLines(raw, new Set(), 25, 0);
    expect(result.canCommit).toBe(false);
    expect(result.rows[0]?.error).toContain('out of bounds');
    expect(result.rows[1]?.error).toContain('out of bounds');
  });

  it('accepts team names of lengths 24, 25, 28, and 32 characters', () => {
    const raw = `
      1 ${'A'.repeat(24)}
      2 ${'B'.repeat(25)}
      3 Lanang nak chicken main pubg
      4 ${'D'.repeat(32)}
    `;
    const result = parseBulkTeamLines(raw, new Set(), 25, 0);
    expect(result.canCommit).toBe(true);
    expect(result.validTeams).toHaveLength(4);
    expect(result.validTeams[2]?.name).toBe('Lanang nak chicken main pubg');
    expect(result.validTeams[2]?.name.length).toBe(28);
  });

  it('rejects team names exceeding 32 characters', () => {
    const raw = `
      1 This Name Has Way Too Many Characters For An Esports Feed
    `;
    const result = parseBulkTeamLines(raw, new Set(), 25, 0);
    expect(result.canCommit).toBe(false);
    expect(result.rows[0]?.error).toContain('exceeds 32 characters');
  });

  it('rejects inputs exceeding max roster limit of 25 teams', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `Team ${i + 1}`).join('\n');
    // already have 20 teams
    const result = parseBulkTeamLines(lines, new Set(), 25, 20);
    expect(result.canCommit).toBe(false);
    expect(result.errorMessage).toContain('exceed 25 teams');
  });
});

describe('TeamRosterEditor - Renumbering Algorithms', () => {
  const initialTeams: TeamRosterEntry[] = [
    { teamNo: 1, name: 'T01', logoUrl: '/api/logos/team-1.png' },
    { teamNo: 2, name: 'T02', logoUrl: '/api/logos/team-2.png' },
    { teamNo: 3, name: 'T03', logoUrl: null },
    { teamNo: 4, name: 'T04', logoUrl: null },
    { teamNo: 5, name: 'T05', logoUrl: null },
    { teamNo: 12, name: 'T12', logoUrl: '/api/logos/team-12.png' },
  ];

  describe('applyRippleShift', () => {
    it('shifts intermediate slots down by +1 when moving downward (12 -> 3)', () => {
      // Dragging team 12 to slot 3
      const result = applyRippleShift(initialTeams, 12, 3);

      expect(result.map((t) => ({ no: t.teamNo, name: t.name }))).toEqual([
        { no: 1, name: 'T01' },
        { no: 2, name: 'T02' },
        { no: 3, name: 'T12' }, // dragged team takes 3
        { no: 4, name: 'T03' }, // former 3 shifted to 4
        { no: 5, name: 'T04' }, // former 4 shifted to 5
        { no: 6, name: 'T05' }, // former 5 shifted to 6
      ]);

      // Check slot provenance (previousTeamNo)
      const moved12 = result.find((t) => t.name === 'T12');
      expect(moved12?.previousTeamNo).toBe(12);
      const shifted3 = result.find((t) => t.name === 'T03');
      expect(shifted3?.previousTeamNo).toBe(3);
    });

    it('shifts intermediate slots up by -1 when moving upward (3 -> 5)', () => {
      // Dragging team 3 to slot 5
      const result = applyRippleShift(initialTeams, 3, 5);

      expect(result.map((t) => ({ no: t.teamNo, name: t.name }))).toEqual([
        { no: 1, name: 'T01' },
        { no: 2, name: 'T02' },
        { no: 3, name: 'T04' }, // former 4 shifted to 3
        { no: 4, name: 'T05' }, // former 5 shifted to 4
        { no: 5, name: 'T03' }, // dragged team takes 5
        { no: 12, name: 'T12' }, // outside range remains untouched
      ]);
    });

    it('moves directly into a vacant slot without shifting other teams', () => {
      // Slot 7 is vacant
      const result = applyRippleShift(initialTeams, 12, 7);

      expect(result.map((t) => ({ no: t.teamNo, name: t.name }))).toEqual([
        { no: 1, name: 'T01' },
        { no: 2, name: 'T02' },
        { no: 3, name: 'T03' },
        { no: 4, name: 'T04' },
        { no: 5, name: 'T05' },
        { no: 7, name: 'T12' }, // directly takes slot 7
      ]);
    });
  });

  describe('applyDirectSwap', () => {
    it('swaps two occupied slots directly without affecting intermediate teams', () => {
      // Direct swap team 1 and team 12
      const result = applyDirectSwap(initialTeams, 1, 12);

      expect(result.map((t) => ({ no: t.teamNo, name: t.name }))).toEqual([
        { no: 1, name: 'T12' },
        { no: 2, name: 'T02' },
        { no: 3, name: 'T03' },
        { no: 4, name: 'T04' },
        { no: 5, name: 'T05' },
        { no: 12, name: 'T01' },
      ]);
    });

    it('moves to a vacant slot when swapping with an empty slot', () => {
      const result = applyDirectSwap(initialTeams, 1, 9);

      expect(result.find((t) => t.name === 'T01')?.teamNo).toBe(9);
      expect(result.find((t) => t.name === 'T02')?.teamNo).toBe(2);
    });
  });
});
