# #311 control failure audit — 2026-10-13

Baseline: `origin/main` 1c9fdbb, package/manifest 2.8.2 / 2.8.2.0,
installed API client 3.3.10. Read issue body and all comments, and merged PR #331.
No fresh reporter logs or confirmation of resolution were present. No remaining
reporter individual-light defect was reproduced. A diagnostic defect was reproduced: the
same device ID with a different discovered model was reported as absent. The
lookup now logs model mismatch distinctly and suggests reselecting the light;
no saved settings or command targets are silently changed.
**Keep #311 open.**

## Current path and evidence

1. `ui/on-off.html` / shared `ui/js/setup.js` uses selectedDeviceId through the
   existing datasource setting. `ActionServices.parseTarget` accepts
   `light:deviceId|model`, legacy `deviceId|model` / selectedModel, and `group:id`.
2. `resolveTarget` reads DeviceService discovery (30-second cache, shared in-flight
   request, bounded discovery, stale-data fallback) and matches both ID and model.
   Groups are loaded from Stream Deck storage and hydrated from discovery/snapshots.
3. `OnOffAction.onKeyDown` resolves services/target inside its error handler. It
   determines explicit On/Off or samples live power for Toggle, then dispatches
   through `controlTarget`. Missing selection/key, unresolved target and command
   failure receive distinct log/feedback paths.
4. `LightControlService.controlLight` has no online pre-command gate.
   `controlGroup` dispatches over **group.lights**, not getControllableLights.
   `ActionServices.applyToTarget` likewise uses the full member set for advanced
   commands. Preparation/effect cancellation also include offline-flagged members.
   The sibling API client's repository sends cloud commands; plugin adapters do
   not require an online flag before dispatch.
5. `fanOutToLights` settles all requests. Partial success returns failed members;
   successful state updates/snapshots survive. Total failure propagates a real
   error. Key actions report existing `⚠ N/M` feedback.
6. A remaining gate was reproduced with failing action tests: offline-flagged
   group members were excluded from power sampling. An already-on group could
   therefore Toggle On repeatedly instead of Off, and group counts/dial values
   showed Off. Key/dial samplers now read all members, retain known power when a
   read is unavailable, and keep full denominators. Online hints still trigger
   cache refresh; they never decide sampling eligibility. Recall's optimistic
   count likewise includes the members actually attempted. This is a reproduced
   group defect, not confirmation of the reporter's individual-light issue.

Existing tests already cover offline power requests, API rejection, all-member
preparation, partial group success and null-path diagnostics. Added audit tests
cover all five basic commands for single/group offline flags, advanced group
operations, successful state retention, stale discovery after failure, and a
same-ID/different-model mismatch with allowlisted diagnostic fields. Fifteen
additional actual-action regressions cover group Toggle direction, live display,
shared keypad sampling, nine hybrid/legacy dials and Recall with zero snapshot ID.

## Logs and redaction limits

`resolveTarget` logs selection IDs, model/count information and booleans, rather
than the entire settings object; regression test verifies secret-bearing settings
are not serialized. Device IDs/names remain potentially personal identifiers.

Inspected installed SDK `@elgato/utils/dist/logging/format.js`: top-level Errors
are rendered as stack text, not their enumerable Axios request/cause fields.
The client is configured with its default silent logger (no raw Axios logger
adapter); its request debug logging redacts Govee-API-Key. Client NetworkError
retains the Axios cause internally, so do not turn on raw error-object JSON
logging or assume this audit proves arbitrary future error messages secret-free.
API response messages and non-Error thrown objects still deserve inspection
before sharing. This audit establishes the inspected normal error path, not a
universal secret-redaction guarantee.

## Evidence needed next

Ask the reporter to install the latest published build, reproduce once, and
provide sanitized `resolveTarget:` / `onoff.toggle` / command-failure lines.
Confirm H619A and H607C work from Govee Home over Wi-Fi/cloud with Bluetooth
unavailable. Record Stream Deck and plugin versions, saved target format/model,
individual versus group behavior, and whether the command is rejected or accepted
without physical effect. Device IDs can be replaced consistently with aliases.
Never request the API key or complete settings/request dumps.

macOS logs:
`~/Library/Application Support/com.elgato.StreamDeck/Plugins/com.felixgeelhaar.govee-light-management.sdPlugin/logs/`

Read locally, inspect before sharing (does not copy/upload automatically):

```sh
grep -hE 'resolveTarget|onoff\.toggle|device\.discover|group\.apply|Command failed|Failed to' \
  ~/Library/Application\ Support/com.elgato.StreamDeck/Plugins/com.felixgeelhaar.govee-light-management.sdPlugin/logs/*.log \
  | tail -30
```

No hardware or Windows/macOS cloud-control reproduction was performed. Tests use
mock API boundaries. Release-note summary: offline cloud hints no longer hide group power/state or
make Toggle choose On repeatedly; target diagnostics distinguish a saved model
mismatch from a missing device. #311 still awaits current reporter evidence.
This diagnostic fix does not establish resolution of the reporter’s control problem.
