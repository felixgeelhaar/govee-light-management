# Stream Deck hardware test plan

This is an execution checklist, not a record of completed hardware testing.
Every case starts **Not run**. Record macOS and Windows results separately.

## Build and scope

- Combined main build: `98e768417492fc48f713463b38419124811dadc7`.
- Package / manifest: `2.9.1` / `2.9.1.0`. This unreleased test build shares the
  published version number; record the commit and installation time too.
- Local installer: `dist/local-test/com.felixgeelhaar.govee-light-management.streamDeckPlugin`.
- Covers SDK 3 migration, cloud request sharing/cooldown, Automation diagnostics,
  obsolete-control removal, and regression testing of all 14 registered actions.
- Stream Deck minimum: 7.1. Test the current host version on both operating
  systems; test 7.1 separately where available. Synthetic protocol tests do not
  replace host or hardware testing.
- Stream Deck Neo Infobar integration is outside this build's scope. Normal Neo
  keys can be included in keypad testing.

## Preparation

1. Export/back up your Stream Deck profile. Note the currently installed plugin
   version and how to reinstall the published build.
2. Use a test profile. Disable unrelated schedules and Automation rules so they
   cannot change the same lights during a test.
3. Install the combined installer and restart Stream Deck. Confirm the running
   plugin is this build, rather than a previously linked development checkout.
4. Have two cloud-controllable lights, named clearly (for example Desk and Wall).
   Verify each works in Govee Home over Wi-Fi/cloud, rather than only Bluetooth.
5. Include an RGB IC segmented light, adjustable white-temperature light, and
   music/effect-capable light where available. Unsupported capabilities are N/A,
   with the model and missing capability recorded.
6. Use a physical keypad and Stream Deck+ for dials, touch feedback and stacks.
   Without a Stream Deck+, those checks remain Blocked, not Pass.
7. Keep Govee Home and plugin logs available. Use a phone/camera to capture the
   hardware LCD, lights and transitions; a desktop screenshot cannot prove the
   physical light changed.

| Record for each run | Value |
| --- | --- |
| Tester / date / build commit / installation time | |
| OS version / architecture | |
| Stream Deck application version | |
| Stream Deck hardware / firmware | |
| Govee models / capabilities / connection type | |
| Fresh profile or upgraded profile | |
| API client dependency version | |
| Other active rules/schedules, if any | |

**Results:** Pass = observed expected result; Fail = observed mismatch; Blocked =
required equipment/environment unavailable; N/A = capability or scenario does not
apply, with a reason. A successful API response alone does not prove the light
changed. Record both when relevant.

**Order:** run I1–I4, K1, D1–D3, G1–G3 and A1–A4 first. Then complete all other
applicable cases. Use the IDs below in the result sheet.

## Installation, SDK and settings

| ID | Steps | Expected result |
| --- | --- | --- |
| I1 | Install over the published build using a backed-up existing profile; restart the host. | Plugin starts without a crash loop; API configuration, supported bindings, custom artwork, groups and rules remain available. |
| I2 | Open the action picker and create each action listed below. Open every inspector. | All 14 actions appear; inspectors load without blank panels, repeated reconnects or errors. No standalone Brightness Dial, Color Hue Dial, Color Temperature Dial or Segment Color Dial entries appear. |
| I3 | On an old profile, inspect bindings to the four retired standalone dial actions. Replace them with Brightness, Color, Color Temperature and Segment Color. | Retired bindings require manual replacement; replacement actions work. No automatic migration is claimed. Saturation bindings remain supported. |
| I4 | Change target and settings, switch selection to another key, then return; change profiles/folders/pages and restart. | Settings persist; controls reflect the selected action; no settings-update loop, lost target or command sent merely by opening an inspector. |
| I5 | Start from an unconfigured action; test missing API key, then valid credentials; refresh device lists. | Clear setup/error/empty feedback; no unrelated device controlled; valid configuration recovers without reinstalling. Never capture the key in screenshots. |
| I6 | Duplicate a configured action; modify only the duplicate; export/import the test profile. | Action-specific settings remain independent; native artwork persists; shared groups/rules keep their documented global scope without accidental duplication. |
| I7 | Run configured actions in host Multi Actions where supported, especially fixed On and fixed Off. | Each supported command retains its configured meaning; host state payloads do not invert On/Off. Unsupported placements are recorded as N/A. |
| I8 | Repeat installation/settings checks on Windows and macOS, and minimum host 7.1 where available. | Equivalent supported behavior; record actual versions and any platform differences. |

## On / Off and native artwork

Use a single light first, then repeat K1–K3 with a group.

| ID | Steps | Expected result |
| --- | --- | --- |
| K1 | Choose Toggle; press On→Off→On. Then test fixed Turn On twice and Turn Off twice. | Physical state follows commands. Fixed commands are idempotent. Toggle follows actual state rather than keypress count. |
| K2 | Change light power externally and refresh/wait for a sample; repeat for a group. | No Icon switching setting exists. All-off selects Off; any-on, including a mixed group, selects On. Failed refresh retains known state. |
| K3 | Test neither custom icon, On only, Off only, and both custom icons using Set from File; repeat with Icon Library. | Each state's native custom artwork takes precedence; uncustomized state uses plugin artwork; light commands still work. |
| K4 | With custom images on both states, restart and export/import the profile. Repeat on an upgraded key that had a custom On image only. | Artwork persists and follows power state. On-only key shows its custom On image and plugin Off artwork. |
| K5 | Use Reset to Default on each state separately. Try an unsupported/unavailable file in the host editor. | Reset affects the selected state. Host rejects the file or provides its normal fallback without breaking plugin commands. |
| K6 | Configure a native custom title; exercise mixed group, slow command and failed command. | Host title/artwork precedence is respected. Existing success/error/loading feedback works where supported; no forced title glyph or corner status dot. There is no Show/Hide status-dot field. |
| K7 | Observe startup before the first live sample; then simulate a failed refresh after a known state. | No crash or misleading successful command; initial fallback settles after a sample and a failed refresh preserves the last known state. |

See [power artwork details](375-power-artwork.md) for native per-state setup.

## Unified keys, dials and dial stacks

For each row, select a supported single light, then a compatible group. Test a
keypad binding and an encoder binding independently.

| ID | Action | Steps and expected result |
| --- | --- | --- |
| D1 | Brightness | Key applies its configured percentage. Rotate both directions using the configured step; physical output, value and bar agree and clamp at supported limits. Dial press and touch toggle power. |
| D2 | Color | Key applies its configured color. Rotation changes hue by its configured step and wraps correctly; press/touch toggle power. Color feedback follows the selected target. |
| D3 | Color Temperature | Key applies configured kelvin; rotation uses configured step and clamps to the device range. Press/touch toggle power; displayed value and physical white temperature agree. |
| D4 | Segment Color | On a compatible RGB IC device, key applies the configured solid/rainbow/gradient range. Dial changes the configured segment's hue; other segments are not unintentionally changed. Test first/last segment and index 0 where available; press/touch toggle power. |
| D5 | Saturation | Key applies configured saturation; rotation uses configured step and clamps to its supported range. Press/touch toggle power; value and physical output agree. |
| D6 | Brightness stack identity | Put two Brightness actions targeting different lights in a dial stack. Switch repeatedly, rotate and press each. The active action shows its own light name, value and bar and controls only its target. |
| D7 | Titles and renaming | Test group, unconfigured target and a long name. Set and clear native custom titles. Rename a saved group; rename a light and refresh discovery. Automatic Brightness identification updates, long names fit sensibly, unconfigured fallback is clear and native titles take precedence. |
| D8 | Stacks and profile lifecycle | Stack unified actions, change profiles/pages, reopen inspectors and restart. Correct active feedback returns; no stale target, duplicate command or rotation acceleration from leaked handlers. |
| D9 | Fast input and mixed groups | Rotate rapidly then reverse; press while refresh is pending; repeat with mixed power and one unreachable group member. Final feedback converges to commanded state; successful members remain updated and partial warnings remain visible. |
| D10 | Capability boundaries | Select devices with different brightness, temperature and segment capabilities. Lists offer compatible targets; unsupported operations fail clearly rather than controlling an unrelated feature. |

Do not infer a separate host dial-stack title API: identification is rendered in
the active action's feedback. See [dial-title checks](378-dial-titles.md).

## Group creation, editing and behavior

| ID | Steps | Expected result |
| --- | --- | --- |
| G1 | Create a two-light group, save it and close/reopen its manager. | A saved entry appears with its name and member names; confirmation and empty/list states are clear. Styling and Edit/Delete behavior match Automation. |
| G2 | Edit its name and members, save, then use existing bound keys and rules. | One entry updates rather than duplicating; existing references retain group identity and use current membership. |
| G3 | Add enough long-named members to overflow the list row; hover the summary. | Actual member names are shown; overflow ends in an ellipsis; full names are available in the tooltip. The summary is not merely “2 lights.” |
| G4 | Try incomplete/invalid input, cancel an edit, and delete an unused group. | Validation prevents invalid saved data; cancel preserves the saved entry; deletion removes it with clear feedback. |
| G5 | Delete a group referenced by a key or rule; then use that binding. | Clear missing-target behavior; no unrelated device command, silent recreation or crash. |
| G6 | Set both members off, both on, then mixed. Use Toggle and fixed commands. | Commands reach all supported members. Any-on group Toggle turns the group off; all-off Toggle turns it on. Aggregate state/counts agree after refresh. |
| G7 | Make one member unreachable; issue power, brightness and another supported command. Restore connectivity. | Reachable members succeed; partial result identifies N/M against full membership; failed reads do not erase known state. Recovery works without recreating the group. |
| G8 | Upgrade a backed-up profile with existing groups and restart. | Existing group data/membership survives migration; no duplicate group or loss of saved references. |

See [group/offline regression checks](311-group-power.md).

## Remaining actions

Only use modes actually advertised for the selected model. A capability ID of 0
is valid; include it when real hardware offers one.

| ID | Action | Steps and expected result |
| --- | --- | --- |
| F1 | Recall | Select an available scene/DIY scene/snapshot, save and press. Correct effect is recalled; change target and confirm choices refresh rather than retaining an incompatible selection. |
| F2 | Scene | Select a supported scene and activate it; change targets and restart. Correct scene is applied and saved selection remains valid for its target. |
| F3 | Snapshot | Select an available snapshot and activate it, including ID 0 where present. Correct snapshot is recalled; unavailable selections fail clearly. |
| F4 | Music Mode | Select each available representative mode and sensitivity; activate and change sensitivity. Physical response matches the configured mode. Record model-specific rejection and sanitized evidence; do not treat an unsupported mode as fixed. |
| F5 | Feature Toggle | Test a supported feature's Toggle, On and Off operations. Correct feature changes; explicit operations remain idempotent and incompatible features are excluded. |
| F6 | Schedule | Create a near-future daily schedule, a weekly schedule on today's weekday, and a short delay schedule. Observe the configured command on the configured target. Press the schedule key to disable/enable it; a disabled schedule must not execute. Test restart/profile changes for documented persistence and ensure no duplicate execution. Record timezone and scheduled/actual times. |
| F7 | Sequence | Create several distinguishable steps with supported targets and commands; edit/reorder and run. Steps execute in saved order. Press again mid-run to cancel; remaining steps stop. Retry after completion and after cancellation. |
| F8 | Custom Effect | On an RGB IC segmented light, choose a preset/configure the effect, start and press again to stop. Preview/settings agree with output; stopping, changing profiles and unloading do not leave duplicate runners. Keep runs short to avoid unnecessary cloud traffic. |
| F9 | Action failure recovery | For F1–F8 where applicable, test missing selection, unavailable target and transient network loss; then restore valid settings/network. Clear error feedback, no unrelated command, no stuck loading and successful recovery. |

Schedule timing across host suspension is a separate observation: record whether
missed runs are skipped or resumed; do not assume the host can execute while asleep.

## Automation rules and lifecycle

Open **On / Off → Automation → Manage rules**. Use a single light first and then
a two-light group. Remove test schedules before lifecycle tests.

| ID | Steps | Expected result |
| --- | --- | --- |
| A1 | Select a light above; open Automation, enable a rule and choose an event; create it. Change the light above. | Disabled by default. Creating produces a saved rule entry/count and confirmation. Target shows the selected light with no dropdown and follows the selection. Editing controls alone do not dispatch a command. |
| A2 | Edit a saved rule's events, including Edit on another target's rule; save, cancel another edit, then delete it. | Save updates one entry; cancel preserves it; delete removes the entry. Clear create/edit states and feedback match Groups. Selecting a rule to edit does not retarget the key. |
| A3 | Save an enabled rule with no events; then disable a valid rule. | No-events rule is visibly inactive; disabled rule never runs. Saving successfully is distinguishable from having an active event. |
| A4 | Enable Plugin starts → On. Turn the light off, quit and reopen Stream Deck. Repeat for a group. | Light/group turns on once network is available within the bounded startup attempt; saved rule survives restart. Verify physical output and lifecycle logs. |
| A5 | Enable Computer wakes → On; keep Stream Deck running, turn lights off and perform real OS sleep/wake. Repeat for a group on both OSes. | Observed wake dispatch turns configured targets on; repeated event notifications do not toggle them off or multiply commands. |
| A6 | Enable Before sleep → Off; refresh observer status, start with lights on, and perform actual sleep. Repeat single/group on both OSes. | Observer readiness is visible. Record physical state and event/command/result logs; a missed notification or incomplete command is a failed/unconfirmed delivery, not a successful off. Host sleep is not blocked. |
| A7 | Enable Before shutdown/logout → Off; test normal logout or shutdown after saving other work. | Record observed best-effort result and logs. Shutdown is never delayed indefinitely. Forced power loss/forced termination has no guaranteed delivery window and is not promised. |
| A8 | Lock screen, switch profiles, turn only the display off and disconnect/reconnect USB. | These do not masquerade as OS sleep/wake rules. Plugin restart can legitimately trigger the separate Plugin starts event. |
| A9 | After an automatic On, manually turn the light off; wait. During a pending automatic retry, issue a manual command, including one targeting an overlapping group member. | No continuous enforcement; manual state persists until the next enabled event. Pending automatic work is cancelled where still cancellable; an already accepted cloud command cannot be recalled. |
| A10 | Trigger repeated wake/resume notifications where reproducible; use overlapping/equivalent targets. | Explicit On/Off remains idempotent; repeated work coalesces. Opposite events cancel obsolete pending work. Record logs rather than relying only on unchanged light state. |
| A11 | Test startup/wake with missing key, deleted target, no network and one unreachable group member; restore each condition. | Distinct failure categories; bounded attempts, no endless retries or blocked host. Partial success is retained. No guarantee of recovery after the bounded retry window. |
| A12 | Move away from the editor profile or remove its editor key while retaining a saved rule. | Rules remain global and operate independently of editor visibility. Delete the rule explicitly to stop it. |
| A13 | Disable/delete/retarget a rule while work is pending; edit/delete a referenced group. | Obsolete pending work stops; future events use current configuration/membership, not a stale prepared target. |
| A14 | Enable an off-event rule, inspect observer status; disable the last off-event rule and unload/restart the plugin. | Helper starts only when needed and exits without an orphan. Startup/wake remain available if the optional native observer is unavailable. Check macOS and Windows separately. |
| A15 | Test Windows hibernate/Modern Standby or other platform-specific power modes where available. | Record mode and actual delivery; unsupported/missed OS notifications are explicit limitations, never generalized as a verified sleep/shutdown guarantee. |

Diagnostic interpretation: `event_received` proves receipt; `command_started`
proves dispatch was reached; `ok`/`partial` reports API completion, not physical
output. Capture timestamps around sleep and wake. Absence of a completion line
does not prove success while the process/network may be suspended.

Timing checks, when logs permit: startup/wake work has a 15-second budget with
one transient retry after 3 seconds; sleep/shutdown has one attempt with a
1.5-second budget. Do not induce prolonged shutdown/network stress to measure
these. Authentication, validation, rate-limit and partial-group outcomes are not
automatic transient retries. See [lifecycle design and limitations](377-power-lifecycle.md).

## Cloud state, diagnostics and recovery

| ID | Steps | Expected result |
| --- | --- | --- |
| C1 | Bind the same light to several keys/dials and a group; leave idle, then change its state in Govee Home. | Shared successful state samples avoid one polling stream per binding; external state normally appears on the next approximately 30-second sample. UI refresh ticks are not necessarily network requests. |
| C2 | Issue a manual command between samples; rotate a dial. | Command and optimistic local feedback remain responsive rather than waiting for the next periodic sample. Physical state subsequently agrees. |
| C3 | If request diagnostics are available, observe several idle minutes. | Successful full-state sampling is shared per device, at most about two samples/minute. Discovery, commands and other endpoints are separate traffic; do not apply this limit to total API requests. |
| C4 | If a natural 429/rate-limit error occurs, capture sanitized timing and recover. | Full-state and fallback requests share a 60-second cooldown; no immediate repeated fallback storm. Do not deliberately flood the live API to manufacture this test. Otherwise mark conditional coverage Blocked. |
| C5 | If a device is discovered with a false cloud-online flag, issue supported single/group commands. | The flag alone does not suppress commands. Record actual API outcome and physical state; false cloud status is not proof the device is reachable. |
| C6 | Rename/remove a device or use an existing stale saved target; refresh discovery and retry. | Missing device/model mismatch/API rejection remain distinguishable; no silent retargeting to another light. Avoid modifying raw profile settings or inventing device IDs on the primary profile. |
| C7 | Disconnect network briefly during a command and during idle refresh; reconnect. | Clear bounded error feedback; known state is preserved when reads fail; UI and commands recover without reinstalling. |
| C8 | After failures, inspect relevant logs and any screenshots before sharing. | Useful target/event/category/partial counts, with no API keys, tokens or raw secret-bearing payloads. Redact personal device identifiers before posting. |
| C9 | Leave several keys/dials, a group and one rule configured through an extended idle session and several profile changes/restarts. | No crash loop, growing helper count, duplicated commands, permanent loading state or obvious UI slowdown. Record duration and resource observations. |

See [cloud request verification](387-cloud-requests.md). Reporter-specific offline
and quota-warning issues are not proven resolved by unrelated successful tests.

## Evidence and result sheet

For failures, capture: case ID, build/OS/host/model, exact settings excluding
secrets, numbered reproduction steps, expected/actual result, physical light
state, local timestamp/timezone, sanitized nearby logs and hardware photo/video.
For UI cases capture both the inspector and physical key/LCD when applicable.

macOS logs:
`~/Library/Application Support/com.elgato.StreamDeck/Plugins/com.felixgeelhaar.govee-light-management.sdPlugin/logs/`.
On Windows, locate this plugin's `logs` folder in the Stream Deck plugin
installation. Collect only the relevant time window; inspect it before sharing.
For offline failures include `resolveTarget:` and command-failure lines; for
lifecycle failures include `power.lifecycle` event/dispatch/completion lines.

Copy this row for each applicable case and platform. All cases are **Not run**
until an execution result is recorded.

| Case ID | Platform / host / hardware | Result | Physical result / actual behavior | Evidence / defect link | Retest |
| --- | --- | --- | --- | --- | --- |
| | | Not run | | | |

## Release review

- All applicable cases have results; critical installation, manual control,
  persistence, groups, artwork, dial stacks and enabled startup/wake paths pass.
- macOS and Windows hardware coverage is explicit. Missing hardware/platform
  checks remain Blocked and require an explicit release decision.
- Before-sleep and shutdown observations are documented per OS. Best-effort
  limitations remain visible; failures are investigated rather than counted as
  passes because shutdown is difficult to test.
- Retired UUIDs are a breaking compatibility change: release/version choice and
  upgrade notes must explicitly tell users which bindings to replace.
- Automated checks are recorded separately: install dependencies, type-check,
  lint, unit tests, Playwright, build and Stream Deck manifest validation. They
  do not substitute for this hardware checklist.
- Resolve failures and rerun affected cases. Do not close #311 without fresh
  reporter confirmation or compelling diagnostic evidence; do not claim other
  reporter issues fixed solely from API success logs.
- No release, merge or issue closure is performed by executing this plan.
