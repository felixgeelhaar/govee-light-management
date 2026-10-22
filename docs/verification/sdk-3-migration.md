# Stream Deck SDK 3 migration

## Scope and compatibility

Upgrade `@elgato/streamdeck` from 2.1.2 to 3.0.3, with its locked schemas/utils.
Keep all 18 action registrations, UUIDs, settings and layouts. No release version
bump, storage migration or new controller is included.

SDK 3 uses its default settings lifecycle and requires Stream Deck 7.1 or later.
The manifest, store requirements and generated release requirements declare 7.1.
There is no legacy compatibility opt-in. Settings reads return their result;
only changes from the Property Inspector trigger settings event handlers. Startup
initialization and Automation save/delete explicitly apply settings and do not
rely on read events. SDK engines support Node >=20.5.1; the Node 20 manifest and
build target remain supported.

SDK 3's Action union additionally includes Neo Infobar actions, which have no
`setTitle`. Nine keypad-only actions now narrow with `isKey()` before appearance
and settings rendering. Existing hybrid dial/key actions already narrow by
controller. Nothing is declared as a Neo controller in this migration.

Official references:
- https://docs.elgato.com/streamdeck/sdk/releases/upgrading/v3/
- https://docs.elgato.com/streamdeck/sdk/guides/neo-infobar/

Infobar support (#384) remains a separate feature: its documented supported
manifest minimum is Stream Deck 7.6. Installing SDK 3 alone does not add it.
The manifest's protocol `SDKVersion` is separate from the npm package version
and is not changed by this dependency migration.

## Automated regressions

- Startup test checks default settings behavior remains enabled before connection, all 18
  actions register, Automation startup and scheduler initialization remain, and
  startup does not write global settings. A manifest test locks the 7.1 minimum.
- Controller tests cover appearance/settings for all nine keypad-only actions
  with an unsupported controller: no key methods, credentials or work required.
- Existing On/Off, offline-group, dial, saved-rule, group and datasource tests
  remain in the full suites. Key mocks now implement the real SDK `isKey` API.
- Initial SDK 3 type-check failed on unsafe Action union access; startup and
  controller tests failed before implementation and pass after it.

## Validation results

- `npm ci`, `npm run type-check`, `npm run lint`, `npm run build` and
  `npm run streamdeck:validate`: passed. Lint reports 93 existing warnings.
- `npm test -- --run`: 896 tests passed across 62 files.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/govee-playwright-browsers npm run test:e2e -- --workers=4`:
  155 tests passed after installing the missing Chromium test browser.
- `npm run test:sdk-protocol`: real SDK checks identified global reads, cached
  action reads, PI global/action notifications and updated action settings on
  synthetic 7.1.0/7.6.0 hosts. Runs in CI on Linux, macOS and Windows.
- Built-plugin WebSocket smoke test with synthetic 7.1.0 and 7.6.0 host messages:
  registration, settings with matching response IDs, Music Mode titles and
  On/Off state rendering passed; no startup global settings writes occurred.
  This used an isolated temporary manifest/log directory and no real devices.
- Local checks ran on macOS arm64 with Node 26.10.0. Node 20 runtime support is
  based on SDK engines and the build target; actual host runtime remains manual.

## Manual verification

Run on both macOS and Windows with Stream Deck 7.1 and current Stream Deck:

1. Back up a profile containing On/Off, Recall, Music Mode, Schedule, Sequence,
   Custom Effect and each hybrid dial. Install the candidate without recreating
   any actions; verify configured targets, values, native custom icons and names.
2. Restart Stream Deck. Check that existing group and Automation entries remain,
   startup rules fire only when configured, and schedules still load.
3. Open each inspector, change its target and a setting, then reopen it. Verify
   persistence and dependent datasource refresh. Refresh a datasource repeatedly;
   confirm no settings loop or repeated commands.
4. Exercise power on/off, group mixed/partial state, Recall, a supported music
   mode, schedule enable/disable, sequence run/cancel and custom effect start/stop.
5. Rotate/press every dial, including a dial stack, and switch profiles. Confirm
   titles, brightness values/bars and warnings remain; no orphan refreshes.
6. Change API key and edit a group/rule; confirm shared settings update without
   losing unrelated groups, schedules, artwork or Automation rules.
7. Confirm the existing release's sleep/wake limitations are unchanged. Check
   logs for startup, settings or SDK errors; redact secrets before sharing.

Real Stream Deck/Govee hardware, installed host versions and Windows operation
are not validated by local unit/browser or protocol-simulator checks.
