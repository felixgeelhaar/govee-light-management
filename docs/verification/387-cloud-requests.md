# #387: cloud request audit

The Govee warning alone does not identify which application or request caused it.
The reporter is on plugin 2.8.1 / Windows 11; fresh logs, device model, active
keys/dials/effects, and other Govee integrations are still needed. Do not describe
this change as a confirmed resolution or close #387 without reporter testing.

## Findings and changes

- The plugin uses the official cloud API, not a local-network transport.
- Dial UI ticks run every 3 seconds. Shared state snapshots formerly expired at
  the same interval, allowing 20 idle state requests per minute per device.
  Snapshots now last 30 seconds across keys/dials/groups (at most two successful
  idle samples per minute per device). Local post-command updates still render
  immediately. Changes made in Govee Home may take about 30 seconds to appear.
- Full-state and fallback power-state reads use separate cloud clients. A rate
  limit on the first client previously fell through to the second. Both paths
  now share a 60-second rate-limit cooldown, including HTTP 429 messages.
- The sibling API client has a per-client aggregate 95/min limiter. It does not
  coordinate two plugin clients, other applications, or per-device endpoints.
  Avoid changing that client's global defaults to solve plugin polling policy.
- Existing effects and commands still consume cloud capacity; this patch does
  not promise prevention of all Govee warnings or change manual command limits.

The current API documents 30 state requests/minute/device; the older API's
10/minute rule is not the endpoint used here:
https://developer.govee.com/reference/get-devices-status

## Verification

Automated regression: `cloud-query-budget.test.ts` covers shared 30-second
sampling and no fallback/cooldown bypass on rate-limit or HTTP 429 responses.
Existing control tests retain offline-flag and partial-group behavior.

Manual reporter test (not performed on their hardware):
1. Record the device model, plugin version and number of visible dials/keys.
2. Temporarily stop the plugin if Govee is actively warning or restricting it;
   avoid repeated rapid commands and note any other Govee integrations.
3. With the test build, leave a single dial idle and check sanitized query logs.
   Successful state reads should be no more frequent than every 30 seconds.
4. Change power/brightness manually; the key/dial should update immediately.
5. Change the same light in Govee Home; allow about 30 seconds for the plugin.
6. Report whether Govee sends another warning. Do not share credentials or full
   settings; redact device identifiers while retaining model/error categories.
