# Changelog

All notable changes to chicken-dinner-feed are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versioning follows
[Semantic Versioning](https://semver.org/), per
[ADR-0009](docs/adr/0009-git-workflow-and-release-process.md).

Entries are written for the person unpacking a release ZIP, not reconstructed from `git log` at
release time — add to `[Unreleased]` in the same change that makes the change.

## [Unreleased]

### Added

- **Team-name length limit on the main leaderboard.** Under Overlays → your leaderboard → Team
  names, set how many characters a team name may show (6–32, default 14). A longer name ends in
  `...`, and the dots count toward the limit, so `Lanang nak chicken main pubg` reads
  `Lanang nak ...`. Emoji and accented letters count as one character and are never cut in half.
  Every row uses the same font size, set by the limit. The panel keeps its width and right edge;
  the ALIVE and ELIMS columns and the gaps between columns were narrowed slightly to give names more
  room. Stored team names are never changed.
- **Extended mode for full team names.** Turn it on next to the limit: names show in full with no
  `...`, and the leaderboard widens to the left (never past its right edge) by as much as the
  longest name needs, up to a maximum you choose (0–480 px, default 200). A name that still does not
  fit scrolls smoothly right to left, pausing on its first letter each time round. Turning it off
  returns to the normal width and `...` straight away. A left-anchored panel never widens past the
  left edge of the screen; the admin shows the effective limit.
- **Current standings / Team order switch** on the Series control page. It orders the standings
  table, the Correct this map and Add map by hand forms, and the finished-map cards either by the
  live standings or by slot (T01→T25). It is remembered per browser and never changes the roster,
  the history or any score.
- **Additional points (bonus or penalty) in Correct this map.** A new Adj. pts column takes a whole
  number from −100 to +100, plus an optional reason. It is added exactly once to that team's match
  points for that map and leaves placement, elims and the official placement and kill points alone,
  so tie-breakers are unchanged. Saving the same correction again never adds it twice. Totals can
  now go below zero. The finished-map cards show each adjustment with its reason and time, the
  backend log records every change, and the postgame match and series screens get an ADJ column
  whenever one exists.
- **Close current map now resets the manual match.** In Manual mode, once the map is recorded the
  app starts a fresh manual match on its own (4 alive, 0 eliminations, same lobby). It happens only
  after a successful close, never touches the recorded map, the roster or a PCOB map, and is
  finished automatically at the next start if the app stopped in between. If the reset itself fails,
  the map stays recorded and the admin asks you to press **Reset manual match**.
- **Provisional results are labelled.** Before a map is closed, the WWCD screens and the post-game
  match screen say **PROVISIONAL — MAP NOT CLOSED**, including on the points; the label disappears
  once the map is closed. The post-game screen's _latest_ setting now shows the current map as soon
  as it has a provisional result, instead of the previous map.

### Changed

- **Redesigned WWCD card.** The winning squad's gold banner, carrying `#1`, the team logo and slot,
  now unfurls from a bronze rod at the top of the card, borrowed from the hanging banners in the
  PMCC 2026 key visual. The team name is the headline and sizes itself to fit long names on one
  line. Player kills, eliminations and points read in plain language ("Points this match",
  "3 of 4 still standing"). With reduced motion turned on in the system, the card appears without
  the unfurl. The fullscreen WWCD screen is unchanged.
- **Correct this map shows the name recorded for that map**, not whoever holds the slot today, so
  a correction made after renumbering teams is labelled with the team that actually played. Rows no
  longer reorder while the form is open.
- **Excel export and import warn about additional points.** The official workbook has no column for
  them: the export keeps the official placement and kill points and lists the adjustments it leaves
  out, and a match-history import warns which recorded adjustments it will reset to 0.
- **Upgrade note:** the overlay protocol is now v11. Browser sources and admin tabs left open from
  the previous version show "out of date — reload" until they are refreshed. Refresh every browser
  source in OBS (right-click → Refresh, or "Refresh cache of current page") and reload the admin
  after upgrading.
- **Leaderboard order follows the Teams order on equal points.** The main leaderboard ranks by
  total points, and teams on equal points are listed in Teams order (T01, T02, …) instead of
  alphabetically; before anyone scores it is exactly the Teams order. Eliminations no longer break
  ties on the main leaderboard, and roster slots that have not joined are no longer pushed to the
  bottom (they stay dimmed). The post-game and series standings keep their official tie-breakers.
- **Close current map now refuses unsafe closes.** A map in which nobody has been eliminated yet is
  rejected, and a close for a match that is no longer running (a double click, a second tab) is
  refused instead of recorded. The button is disabled while it works.
- **Extended team names scroll only when they really do not fit, and Final 4 names scroll too.**
  The decision now comes from what is on screen, so a name never stops on `...` without moving, at
  any resolution, size setting or show/hide animation. Final 4 cards scroll a long name at the same
  speed as the leaderboard instead of cutting it off.

### Fixed

- **The post-game screen named the wrong WWCD before the map was closed.** It invented a placement
  for the surviving team from its position in the table and then crowned the highest scorer. It now
  names the confirmed last team standing (or says the winner cannot be confirmed yet), the same team
  as the WWCD screens.
- **A closed map without a placement #1 no longer crowns the #2 team**; the screens say "WWCD not
  recorded" and the admin flags the map (and the Excel import warns). The WWCD screen's fallback to
  the last closed map now shows the name and logo recorded for that map, not the slot's current
  team.
- **The leaderboard no longer slides sideways after Save.** Turning extended mode on or off (or a
  font finishing loading) made every row slide in from the old position for half a second, in OBS
  and in the admin preview; the panel now changes width in place while rank changes still animate.
- **The glow behind the post-game WWCD team was cut into a hard band** when team logos are off. It
  now fades out fully inside the card.
- **A second "Close current map now" right after a manual reset recorded the empty new match** as
  a map with made-up placements. It is now refused.

## [1.2.0] - 2026-08-30

### Added

- **Add map by hand**, on the Series control page: record a map the app never saw played — one from
  before it was running, or from another machine — at any position in the series, not just at the
  end. Inserting one between two existing maps renumbers everything after it and recalculates every
  team's series total. Enter placements and eliminations only; points come from your scoring
  ruleset, exactly as they do for a correction.

### Fixed

- **The PTS column stopped counting after "Close current map now".** If you closed a map while the
  game was still running, every elimination scored afterwards was thrown away — the column sat at
  the series total until an entirely new match started. It now keeps counting what is earned after
  the close, while still not counting the closed map twice.
- **Warmup no longer creates anything.** Before the plane launches, players are already reported and
  the app could treat that as a match: recording a finished map — final placements and all, for a
  round nobody had played — into the series history, and logging a team wiped on the warmup island
  as eliminated, which stuck for the whole round that followed. Nothing is recorded now until the
  round genuinely starts (the whole lobby entering the air at once, or — if the app connects after
  everyone has already landed — a team's real placement becoming known, never a kill or a knockout,
  since PUBG Mobile's warmup island allows real PvP and either can happen there too), and no team
  greys out or drops off the "teams remaining" count for being wiped on the warmup island. Any kills
  scored on the warmup island are also netted out of the round's kill count the moment it starts,
  even if the API itself keeps reporting them. The leaderboard still shows normally during warmup,
  with the series standings so far.
- **A map no longer closes on `isInGame`/`FinishedStartTime` reporting the match has ended.** That
  signal turned out unreliable in practice — it locked onto "ended" while most of the lobby was
  still fighting, instantly handing every team still alive a full final placement live on air.
  Automatic closing now trusts a single, different signal instead: only one team having any player
  left standing, checked directly against the actual player data rather than an upstream field —
  the literal definition of a battle royale round having concluded. "Close current map now" remains
  as an explicit backup for anything this does not catch (a stopped scrim, or any other way a round
  can end without coming down to one team).
- **Closing the same match twice, or with nothing running, is refused** instead of writing a
  duplicate or empty entry that then has to be found and deleted by hand. Use "Add map by hand" to
  record an extra map deliberately.
- **Automatic closing could have fired early in warmup**, before every team's players had even
  arrived once, for the same reason automatic closing generally needed hardening above. It now
  checks the same "still warming up" state the manual button already refused to act on.
- **Two overlapping attempts to close a map — automatic racing another automatic, or racing a
  manual click — could both succeed and silently overwrite each other**, in the rare case one
  started before the other had fully finished. Every change to your series history (closing,
  correcting, deleting, adding by hand, resetting) is now processed one at a time.
- **The overlay could momentarily show a false "match ended" state** — full placements for every
  team, before anyone had actually placed — on a single glitched update where the app briefly saw
  fewer teams than are actually playing. It now cross-checks against everything it has already
  observed this match before ever treating a "the match ended" signal as real.

## [1.1.0] - 2026-08-29

### Added

- **Import & Export** (see ADR-0017): a new admin page downloads everything you have configured —
  overlays, team logos, the scoring ruleset, custom fonts, and the full series/map history — as one
  backup ZIP, and restores it on any machine (a fresh install included) with a couple of clicks.
  Not included: this machine's own `.env` (network settings) and which overlays are currently on
  air, neither of which is meant to travel. Importing is checked and shows you exactly what it
  contains before anything is changed, and never partially applies a broken or incomplete backup.
- Multi-map series scoring (see ADR-0015): a new **Series control** admin page tracks points across
  an entire tournament rather than one map at a time. A map closes automatically once the match
  data confirms it has ended, or manually from the new page; either way its final placements,
  eliminations and points are recorded permanently, with start/end times shown in your own time zone
  and a duration. Past maps can be corrected or deleted if auto-detection got one wrong. A series can
  be reset at any time — this clears the recorded history only, not whatever map is currently being
  played.
- The PTS column now reflects the whole series: points already banked in earlier maps, plus this
  map's own eliminations, plus a **guaranteed-minimum** placement credit for any team still alive
  (the worst position it could still possibly finish in, given how many teams remain) — so the
  leaderboard reflects a team's real standing sooner than waiting for it to actually place.

### Fixed

- The built-in fonts (Inter, Rajdhani, Barlow Condensed) previously depended on whatever happened to
  be installed on the machine running the app — on a fresh Windows install, none of them are, so an
  overlay quietly rendered in a different font than the one selected. They now load live from Google
  Fonts (see ADR-0016), each a single named weight ("Inter Bold", "Rajdhani SemiBold", "Barlow
  Condensed SemiBold") rather than a family, so the same choice looks the same everywhere. This needs
  internet on the machine running the app; a new **Arial** choice needs none, for a venue without it.

## [1.0.2] - 2026-08-29

### Changed

- `HOST` now defaults to `0.0.0.0` (every network interface) instead of `127.0.0.1`, so a Stream
  Deck / Companion box on another machine works with no `.env` change. **This also exposes the
  admin UI — which has no authentication — to everyone on the network by default**; the existing
  startup warning now fires on a fresh install rather than only after an explicit opt-in. Set
  `HOST=127.0.0.1` in `backend\.env` to restrict it to this machine, as before.
- `INGEST_SOURCE` now defaults to `pcob` (the real observer API) instead of `mock`, now that a live
  match capture has confirmed the real client's field spellings (see `specs/PCOB-API.md` §8). `mock`
  remains available for rehearsing overlay setup without a running match.
- The startup log always prints `http://localhost:<port>` regardless of the configured `HOST`, since
  that is the address an operator actually opens in a browser on this machine.

## [1.0.1] - 2026-08-29

### Fixed

- The `v1.0.0` release ZIP shipped a full `node_modules` and three seeded
  `backend/data/*.json` files — the smoke test added for that release installed and booted the app
  directly inside the bundle that then got zipped, rather than a disposable copy. **If you
  downloaded `v1.0.0`, re-download `v1.0.1` instead** — the packaging is fixed, nothing about the
  application itself changed. The release workflow now runs its install/boot checks against a
  copy of the bundle, and independently re-checks the final ZIP's contents before publishing.
- `/api/health` and `/feedback` reported a hardcoded `"0.1.0"` regardless of the actual release
  version, in every release so far. The version is now read from `package.json` at startup instead
  of a hand-copied literal.
- The bundle-assembly step's own smoke test (installing and booting the app to verify it works)
  would flag `backend/data/fonts` and `backend/data/logos` as unexpected contamination, since
  `LogoStore`/`FontStore` create them on first run — a third instance of the same class of bug as
  the `node_modules` one above. Caught by CI before anything was published.

## [1.0.0] - 2026-08-29

The first tagged release. **Known issue, fixed in 1.0.1:** the published ZIP for this version
shipped `node_modules` and seeded config files it should not have — see 1.0.1's entry. The
"no bundled `node_modules`" line below described the intent correctly; the release pipeline that
was supposed to guarantee it had a gap.

### Added

- Live-updating leaderboard overlay (rank, team logo, per-player health/alive state, points,
  eliminations), animated, resolution-independent from 1080p to 4K.
- Admin UI: overlay instance management, appearance editor with a live preview, team roster editor
  with logo upload and one-click `TeamLogoAndColor.ini` import, scoring ruleset editor, custom font
  upload.
- Real PCOB ingestion (`PcobSource`), verified against a live match; a deterministic mock source for
  development and rehearsal without a running game.
- `/feedback` endpoint and HTTP overlay control for Stream Deck / Companion integration.
- Bilingual (EN/HU) operator documentation and an all-in-one Windows bundle
  (`install-dependencies.bat` + `startup.bat`), installed and started with no bundled `node_modules`
  or copy of Node itself — `install-dependencies.bat` resolves those on the operator's machine, and
  skips reinstalling when nothing has changed.
- A hardened release pipeline: the published bundle is smoke-tested (installed and booted) and its
  runtime dependencies audited before publishing, and the tag is checked against `package.json`
  before anything is built.

### Fixed

- Team placement now trusts PCOB's own `rank` field instead of only an internal elimination-order
  guess, and a roster team that never joined a match no longer outranks one that did.

[Unreleased]: https://github.com/vargamolnarbertalan/chicken-dinner-feed/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/vargamolnarbertalan/chicken-dinner-feed/releases/tag/v1.2.0
[1.1.0]: https://github.com/vargamolnarbertalan/chicken-dinner-feed/releases/tag/v1.1.0
[1.0.2]: https://github.com/vargamolnarbertalan/chicken-dinner-feed/releases/tag/v1.0.2
[1.0.1]: https://github.com/vargamolnarbertalan/chicken-dinner-feed/releases/tag/v1.0.1
[1.0.0]: https://github.com/vargamolnarbertalan/chicken-dinner-feed/releases/tag/v1.0.0
