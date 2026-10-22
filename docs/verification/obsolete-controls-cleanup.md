# Obsolete controls cleanup

Four standalone encoder UUIDs are removed: `brightness-dial`, `colorhue-dial`,
`colortemp-dial`, and `segment-color-dial`. Their existing bindings stop working;
replace them with Brightness, Color, Color Temperature, and Segment Color.
Saturation retains `saturation-dial` and supports both controller types.

Retired status-dot preferences and rendering are removed. State artwork,
native On/Off icon switching, saved group migration, and shared encoder art
assets remain in use and are retained. Old dot settings are ignored.

## Manual verification

1. Open Stream Deck and confirm the four standalone legacy entries are absent.
2. Bind each of the five unified controls to a key and a Stream Deck+ dial.
3. Select a light, then a group; check fixed-value key presses, rotation,
   power toggling and group partial-failure warnings.
4. For Brightness, switch between stacked dials and check title, value and bar.
5. For On/Off, test icon switching disabled/enabled with native custom artwork.
   There must be no status-dot preference or rendered dot.
6. Restart the host; check saved targets, groups and Automation rules persist.

Automated checks exercise manifest registrations, unified inspector controls,
state artwork, group behavior and the SDK settings protocol. Hardware behavior
and Windows host behavior have not been manually verified for this cleanup.

No version bump, release, or profile rewrite is part of this change. Removing
UUIDs is a breaking change and must be considered when choosing the release.

## Validation results

- Type-check, including `--noUnusedLocals --noUnusedParameters`: passed.
- ESLint: passed with 87 warnings and no errors.
- Unit suite: 874 tests across 63 files passed.
- Browser suite: 151 tests passed against the remaining inspectors.
- SDK protocol: passed on synthetic Stream Deck 7.1.0 and 7.6.0 hosts.
- Production build and Elgato manifest validation: passed. Build reports
  dependency annotation/circular-reference warnings.
- Local environment: macOS arm64, Node 26.10.0. Localhost tests and remote
  schema validation were rerun with the required environment access.
