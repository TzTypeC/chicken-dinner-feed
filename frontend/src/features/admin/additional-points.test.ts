import { describe, expect, it } from 'vitest';
import { parseAdditionalPoints } from './additional-points';

describe('parseAdditionalPoints', () => {
  it.each([
    ['5', 5],
    ['+5', 5],
    ['-10', -10],
    ['\u221210', -10],
    [' 0 ', 0],
    ['-0', 0],
    ['100', 100],
    ['-100', -100],
  ])('accepts %j as %d', (raw, expected) => {
    expect(parseAdditionalPoints(raw)).toEqual({ ok: true, value: expected });
  });

  it.each(['', '   ', '-', '+', '1.5', '5e1', 'abc', 'NaN', 'Infinity', '--5', '0x10', '1 0'])(
    'rejects %j instead of treating it as 0',
    (raw) => {
      expect(parseAdditionalPoints(raw).ok).toBe(false);
    },
  );

  it('rejects values outside −100…+100', () => {
    expect(parseAdditionalPoints('101').ok).toBe(false);
    expect(parseAdditionalPoints('-101').ok).toBe(false);
    expect(parseAdditionalPoints('999').ok).toBe(false);
  });
});
