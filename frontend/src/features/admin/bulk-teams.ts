export interface ParsedBulkTeamRow {
  lineIndex: number;
  raw: string;
  slot: number | null;
  name: string;
  error: string | null;
}

export interface ParseBulkResult {
  rows: ParsedBulkTeamRow[];
  validTeams: Array<{ teamNo: number; name: string }>;
  canCommit: boolean;
  errorMessage: string | null;
}

/**
 * Parses multiline team entries supporting:
 * - `[Slot] [Team Name]` (e.g. "1 Alpha" or "T01 Alpha")
 * - `[Slot], [Team Name]` (e.g. "1, Alpha")
 * - `[Team Name]` (auto-assigns lowest available unused slot 1-25)
 */
export function parseBulkTeamLines(
  rawText: string,
  existingSlots: Set<number>,
  maxTotalTeams: number = 25,
  currentCount: number = 0,
): ParseBulkResult {
  const lines = rawText.split('\n');
  const rows: ParsedBulkTeamRow[] = [];
  const allocatedSlots = new Set<number>(existingSlots);
  const validTeams: Array<{ teamNo: number; name: string }> = [];

  // Pass 1: Parse syntax and process explicit slots first to reserve them
  interface PreParsed {
    lineIndex: number;
    raw: string;
    explicitSlot: number | null;
    name: string;
  }
  const preParsed: PreParsed[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const trimmed = raw.trim();
    if (!trimmed) continue; // ignore empty lines

    // Matches e.g. "1 Alpha", "T01 Alpha", "1, Alpha", "12 - Alpha"
    const slotMatch = trimmed.match(/^(?:T|TEAM\s*)?(\d{1,2})[\s,:-]+(.+)$/i);
    if (slotMatch) {
      const slotNum = parseInt(slotMatch[1]!, 10);
      const teamName = slotMatch[2]!.trim();
      preParsed.push({
        lineIndex: i + 1,
        raw,
        explicitSlot: slotNum,
        name: teamName,
      });
    } else {
      preParsed.push({
        lineIndex: i + 1,
        raw,
        explicitSlot: null,
        name: trimmed,
      });
    }
  }

  if (preParsed.length === 0) {
    return { rows: [], validTeams: [], canCommit: false, errorMessage: null };
  }

  // Check total capacity
  if (currentCount + preParsed.length > maxTotalTeams) {
    return {
      rows: preParsed.map((p) => ({
        lineIndex: p.lineIndex,
        raw: p.raw,
        slot: p.explicitSlot,
        name: p.name,
        error: `Adding ${preParsed.length} teams exceeds maximum roster capacity (${maxTotalTeams} teams)`,
      })),
      validTeams: [],
      canCommit: false,
      errorMessage: `Cannot add ${preParsed.length} teams: total roster would exceed ${maxTotalTeams} teams (currently ${currentCount}).`,
    };
  }

  const batchUsedSlots = new Set<number>();

  for (const item of preParsed) {
    let error: string | null = null;
    let targetSlot = item.explicitSlot;

    if (!item.name) {
      error = 'Team name cannot be empty';
    } else if (item.name.length > 24) {
      error = `Name exceeds 24 characters (${item.name.length} chars)`;
    }

    if (!error && targetSlot !== null) {
      if (targetSlot < 1 || targetSlot > 25) {
        error = `Slot ${targetSlot} is out of bounds (must be 1–25)`;
      } else if (batchUsedSlots.has(targetSlot)) {
        error = `Duplicate slot ${targetSlot} in bulk batch`;
      } else if (allocatedSlots.has(targetSlot)) {
        error = `Slot ${targetSlot} is already occupied in active roster`;
      } else {
        batchUsedSlots.add(targetSlot);
        allocatedSlots.add(targetSlot);
      }
    }

    rows.push({
      lineIndex: item.lineIndex,
      raw: item.raw,
      slot: targetSlot,
      name: item.name,
      error,
    });
  }

  // Pass 2: Assign lowest free slot for rows with auto slot
  for (const row of rows) {
    if (row.slot === null && !row.error) {
      let foundSlot: number | null = null;
      for (let s = 1; s <= 25; s++) {
        if (!allocatedSlots.has(s)) {
          foundSlot = s;
          break;
        }
      }
      if (foundSlot === null) {
        row.error = 'No available slots (1–25) remain';
      } else {
        row.slot = foundSlot;
        allocatedSlots.add(foundSlot);
        batchUsedSlots.add(foundSlot);
      }
    }
  }

  const anyError = rows.some((r) => r.error !== null);
  if (!anyError) {
    for (const row of rows) {
      if (row.slot !== null && row.name) {
        validTeams.push({ teamNo: row.slot, name: row.name });
      }
    }
  }

  return {
    rows,
    validTeams,
    canCommit: !anyError && validTeams.length > 0,
    errorMessage: anyError ? 'Please resolve errors in the input before adding teams.' : null,
  };
}

