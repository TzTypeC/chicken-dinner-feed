import { ADDITIONAL_POINTS_MAX, ADDITIONAL_POINTS_MIN } from '@cdf/shared';

export type AdditionalPointsParse = { ok: true; value: number } | { ok: false; error: string };

/**
 * Strict parse of an operator's Additional Points entry (Part 8).
 *
 * A whole number from −100 to +100, an optional leading `+`/`-` (a typographic `−` is accepted too).
 * Anything else, including an empty field, is an explicit error rather than a silent 0 — clearing a
 * penalty is done by entering 0 (or the row's Reset button), never by accident.
 */
export function parseAdditionalPoints(raw: string): AdditionalPointsParse {
  const text = raw.trim().replace('\u2212', '-');
  if (text === '') return { ok: false, error: 'Enter a whole number (0 for none).' };
  if (!/^[+-]?\d{1,3}$/.test(text))
    return { ok: false, error: 'Whole numbers only, e.g. 5 or -10.' };
  const value = Number(text);
  if (value < ADDITIONAL_POINTS_MIN || value > ADDITIONAL_POINTS_MAX) {
    return {
      ok: false,
      error: `Must be between ${ADDITIONAL_POINTS_MIN} and +${ADDITIONAL_POINTS_MAX}.`,
    };
  }
  // `-0` reads back as plain 0.
  return { ok: true, value: value === 0 ? 0 : value };
}
