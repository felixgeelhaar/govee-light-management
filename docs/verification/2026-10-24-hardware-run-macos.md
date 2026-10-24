# Hardware run — macOS, 2026-10-24

Execution record for [the hardware plan](stream-deck-test-plan.md).

| Record | Value |
| --- | --- |
| Build | `98e7684` + uncommitted fixes (Icon switching removed, Automation target follows selection), packed locally as `2.9.1.2` so the host would accept a reinstall |
| Installed | 2026-10-24 11:1x UTC, replacing 2.9.0.0 (then 2.9.1.0 / 2.9.1.1 test builds) |
| OS | macOS 27.0.1, arm64 |
| Stream Deck | 7.6.0.23012 |
| Hardware | Stream Deck + |
| Govee | Desk (H6056), Backlight; 6 lights discovered |
| Profile | Upgraded local-development profile, no backup (by choice) |
| API client | `@felixgeelhaar/govee-api-client` ^3.4.0 |

## Results

| Case | Result | Physical result / actual behavior | Evidence / defect | Retest |
| --- | --- | --- | --- | --- |
| I1 | Pass (log) | Installed over 2.9.0.0; clean SIGTERM shutdown and single restart, no crash loop; discovery found 6 lights. | Plugin log 10:54:40–10:55:06 UTC | |
| — | Fixed | On/Off "Icon switching" setting made custom Off artwork look broken; removed, key always follows power state. | Tester feedback | K2–K4 on 2.9.1.2 |
| — | Fixed | Automation Target dropdown was redundant; replaced with a label taken from the device above. | Tester feedback | A1 |
| — | Fixed | Target label did not follow a device picked in the inspector (host does not echo PI `setSettings`). | Reproduced in unit test; fixed in 2.9.1.2 | Pass on 2.9.1.2 |
| — | Observation | Each inspector open sends `getDevices` twice ~45 ms apart. Harmless; investigate later. | Plugin log | |
| — | Observation | Same-version installer (2.9.1.0 over 2.9.1.0) is silently skipped by the host; bump the fourth version digit for local reinstalls. | | |
| A6 | Blocked | Neither Apple menu → Sleep nor `pmset sleepnow` suspended this MacBook (AC power, lid open, idle-sleep assertions from caffeinate/Claude/coreaudiod). Plugin discovery kept its 30 s cadence without a gap 11:16–12:12 UTC; pmset logged only display off/on. No `sleep` event reached the plugin. | Plugin log; `pmset -g log` | Needs a real system sleep |
| A8 | **Fail** | Display off/on without system sleep produced `wake` events (11:18:24, 11:18:34, 11:24:52, 12:08:29, 12:10:36, 12:10:58 UTC). With a "Computer wakes → On" rule each one sent Desk **On** (`category: ok`). Two wakes 10 s apart at 11:18 arrived while no native observer was running, so at least one source is the Stream Deck host `systemDidWakeUp`. | Plugin log `power.lifecycle` lines | **Pass on 2.9.1.3**: display off/on at 12:47:54 UTC logged `wake_ignored_not_suspended`; Desk stayed off (tester observed). |
| K1 | Observation | Tester pressed the physical Desk toggle once at 12:32:22 UTC; plugin received two key-downs 405 ms apart (off, then on). Host log does not record presses. ~80 s after the Stream Deck+ reconnected (14:31:01 local). Not reproduced: 5 further single presses (12:53:50–12:55:13 UTC) produced exactly 5 alternating commands, each verified within ~250 ms. | Plugin log; StreamDeck.log | Watch for recurrence |
| G6 | Pass | Office (Desk + Backlight): both off → Office **On**, both on (14:35:32 UTC). Desk key then read on and turned Desk **off** (14:35:40). Mixed (Desk off, Backlight on) → Office **Off**, Backlight off (14:36:05). Group state reached the single-light key. | Plugin log; tester observed | |
| G6 | Observation | 13:00:47 Office Off, then 13:00:50 Desk key read Desk as on and sent Off again. Not reproduced at 14:35 with an 8 s gap. Likely the Desk press read state while the group command was still in flight (members are recorded only after the fan-out settles). Group commands log no completion line, so the duration cannot be confirmed. | Plugin log | Fixed in `862f210`: `light.command` logs completion and duration |
| A8 | Pass | 14:27:49 UTC wake event with no suspension (discovery cadence unbroken) logged `wake_ignored_not_suspended`. | Plugin log | |
| I5 | Pass (log) | 11 unconfigured MCP-panel actions pressed via Elgato MCP (12:55–12:58 UTC): no command, read or error. Only On/Off logged the ignored press. | Plugin log | Fixed in `862f210`: all 14 actions log it |
| I2 | Pass | All 14 actions listed; no retired dial entries. Every inspector opened from the host window (15:28–15:32 UTC, Stream Deck+ keys/dials and MCP Actions panel): Brightness, Color, Color Temperature, Segment Color, Saturation, On/Off, Recall, Scene, Snapshot, Music Mode, Feature Toggle, Schedule, Sequence, Custom Effect. No console errors, no error hints, no API-key prompt; opening inspectors sent no light command. | Remote debugger probe; plugin log | |
| I2 | Observation | Inspector opens produced 38 `getDevices` requests for ~26 opens. Both requests of a pair are answered from the 30 s discovery cache, with no extra network call. The plugin's `setup.js` sends none on load (verified in a browser test); the repeat comes from the vendored SDPI select's datasource loading. | Plugin log | Not fixing: no network cost, vendored code |
| F8 | Observation | Custom Effect key is saved with the group Office as its target. Custom effects reject groups (13:00:44 WARN on press), yet the inspector shows "Office (2 lights)" as the selected device with no hint. Two `getDevices` replies carried a single option group (lights only), so the filter likely works and the stale saved value is what is shown. | Screenshot; plugin log | Fixed in `fdabfda`: groups greyed out, saved group explained |
| D1 | Pass | Brightness key (MCP panel, target Office, no saved value → default 50 %) dimmed both lights to 50 % (15:33:55 UTC). Dial 1 (Brightness, Office, step 5): right 3 / left 3 changed the strip and lights in 5 % steps; dial press toggled power off and on. | Tester observed; no plugin log lines for brightness commands or dial input | |
| D1 | Observation | Successful Brightness key/dial commands write no log line, so hardware results cannot be checked from logs. The MCP key is titled "Desk light" but targets Office (profile configuration). | Plugin log | Fixed in `862f210`: `light.command` per completed command |
| D2 | Pass | Color key (MCP panel, Desk, no saved colour → default #ffffff) turned Desk white. Dial 2 (Color, Office): rotation moved the hue (white → yellow, back to red); dial press toggled off and on, light returned in the last colour (red). Full-circle wrap not explicitly observed. | Tester observed | Wrap check |
| D3 | Pass | Dial 3 (Color Temperature, Office): range 2000–9000 K, matching what both members advertise (Desk H6056 and Backlight H61B5: `colorTem.range` 2000–9000, precision 1), so the union is correct, not the fallback. Smooth at both ends, no errors; dial press off/on worked. Key half not run (MCP 4500K key unconfigured). | Tester observed; `getDeviceDebug` via inspector | Key half |
| G1 | Pass | Created "Test Group" (Desk, Backlight, Head Light 2nd); plugin saved it with its own ID (16:25:01 UTC); list showed name and member names; summary "Manage groups · 2". | `getGroups` via inspector; plugin log | |
| G2 | Pass | Renamed to "Test Group edited", then removed Head Light 2nd (saves 16:28:27 and 16:28:36 UTC). Same group ID, 2 members, no duplicate; Office and the Desk Automation rule unchanged. | `getGroups`; plugin log | |
| G3 | Pass | "Test Group edited" saved with 6 lights (16:30:56 UTC). Member line overflows and is cut with an ellipsis on one line; row height unchanged (41 px, same as Office); Edit/Delete stay at the same position; no horizontal page scroll; hover title holds the full member list. | Remote debugger layout probe; plugin log | |
| C8 | Pass | Both plugin log files (711 lines, 10:54–16:33 UTC) contain no API key, token, authorization header, UUID-shaped secret or long opaque string; one WARN, no ERROR. Logs do contain device IDs (MAC-like) and names: redact before sharing, as the plan says. | Log scan | |
| C3 | Fixed | While idle, account discovery runs every 29–30 s without pause (120/h, ~2,880/day; median 562 ms, max 3.96 s). Cause: periodic key/dial syncs call `resolveTarget`, which calls `DeviceService.discover()` whenever the 30 s cache lapses. The device list rarely changes, so this is avoidable traffic against a rate-limited API. Full-state samples are not logged, so the per-device sample rate (C3's actual criterion) cannot be verified from logs. | Plugin log cadence | Fixed in `dc86f89` (10-minute inventory); full-state samples still unlogged |
| C9 | Pass | 55 one-minute samples, 16:34–17:34 UTC, plugin pid 78955 unchanged: RSS 20–44 MB with no upward trend, 141–143 open file handles, exactly one child (the sleep observer) throughout. | `ps`/`lsof` monitor | |
| C3 | Pass on 2.9.1.4 | After installing `2.9.1.4` (all branch commits), idle discovery ran at startup (19:42:18 UTC) and next at 19:52:19, exactly 10 minutes later, with nothing in between. 2.9.1.3 ran it every 30 s. | Plugin log | |
