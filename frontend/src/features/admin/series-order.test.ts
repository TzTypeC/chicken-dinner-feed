import { describe, expect, it } from 'vitest';
import { orderTeamNos } from './series-order';

describe('orderTeamNos (Part 8 Series Control ordering)', () => {
  // Backend standings: T07 leads, then T02, T15, T01.
  const standings = [7, 2, 15, 1];

  it('Current Standings keeps exactly the backend ranking', () => {
    expect(orderTeamNos([1, 2, 7, 15], 'standings', standings)).toEqual([7, 2, 15, 1]);
  });

  it('Team Order is the canonical slot order, not alphabetical or ranked', () => {
    expect(orderTeamNos([15, 1, 7, 2], 'teamNo', standings)).toEqual([1, 2, 7, 15]);
  });

  it('only re-orders the given set: a map with fewer teams keeps just its own teams', () => {
    expect(orderTeamNos([1, 15], 'standings', standings)).toEqual([15, 1]);
  });

  it('puts slots missing from the current standings after the ranked ones, by slot', () => {
    // T20 and T19 played that map but have since been deleted from the roster.
    expect(orderTeamNos([20, 1, 19, 7], 'standings', standings)).toEqual([7, 1, 19, 20]);
  });

  it('is deterministic whatever the input order, and never mutates its input', () => {
    const input = [15, 7, 1, 2];
    const frozen = [...input];
    const shuffled = [2, 1, 15, 7];

    expect(orderTeamNos(input, 'standings', standings)).toEqual(
      orderTeamNos(shuffled, 'standings', standings),
    );
    expect(orderTeamNos(input, 'teamNo', standings)).toEqual(
      orderTeamNos(shuffled, 'teamNo', standings),
    );
    expect(input).toEqual(frozen);
  });

  it('switching back and forth round-trips without losing or duplicating a team', () => {
    const asTeamOrder = orderTeamNos([7, 2, 15, 1], 'teamNo', standings);
    const back = orderTeamNos(asTeamOrder, 'standings', standings);
    expect(back).toEqual([7, 2, 15, 1]);
    expect(new Set(back).size).toBe(4);
  });
});
