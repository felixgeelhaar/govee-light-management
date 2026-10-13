# PC power lifecycle automation (#377)

Status: implemented in draft PR #380, not released. The initial design review was
followed by user authorization to implement the remaining scope. This includes
SDK startup/wake and opt-in native notification observers for sleep/shutdown.

## Event sources and lifetime

| Event | macOS | Windows |
| --- | --- | --- |
| Plugin start | after SDK connection | same |
| Wake | SDK systemDidWakeUp; AppKit when native hook enabled | SDK; .NET PowerModes.Resume when enabled |
| Sleep | NSWorkspaceWillSleepNotification | SystemEvents.PowerModeChanged / Suspend |
| Shutdown/logout | NSWorkspaceWillPowerOffNotification | SystemEvents.SessionEnding |

The SDK exposes wake but no sleep/shutdown notification. Action visibility and
SIGTERM/SIGINT are not interpreted as PC power events. The packaged observer uses
stock `/usr/bin/osascript` JXA/AppKit or Windows PowerShell/.NET with a private
stdio channel. One observer runs per plugin only for explicit enabled off-event
rules. It receives no credentials/device data and emits only ready/sleep/wake/
shutdown. Parent stdin closure ends it even after a plugin crash; unload also
bounds forced cleanup. No polling, elevated service, login agent, separately
signed binary, execution-policy change or new action UUID is required.

## Layers

- `shared/power-lifecycle.ts`: allowlisted rule schema and target canonicalization.
- `PowerLifecycleService`: event debounce, budgets, prepared targets, retry and
  manual override policy, configuration generations and cancellation.
- `PowerLifecycleController`: SDK listeners, account storage and serialized PI
  messages. Writes require a successful fresh settings read and preserve other
  global fields. Global rule/group/key changes cancel obsolete work.
- `NativePowerEvents` + packaged scripts: bounded private event protocol and process
  lifetime. Failure is reported in the PI; SDK startup/wake remains available.
- `BoundedPowerClient`: fixed documented power POST with AbortSignal, safe error
  categories and no hidden retry middleware. Installed govee-api-client 3.3.10
  was inspected: it supports timeouts but no per-command signal. Existing manual
  command transport remains unchanged.
- `ActionServices`: resolves actual saved references/local groups without cloud
  discovery, cancels effects, dispatches full-member fan-out and retains reached
  snapshots. Existing manual command entry points pause automation; global key/
  dial input hooks catch intent before slow target resolution.
- On/Off PI: explicit account-rule Save/Delete, disabled defaults and observer
  availability. Rules remain active independently of key visibility.

Requests are explicit On/Off, idempotent, and coalesced for five seconds per target.
Wake/start gets one transient retry after three seconds, at most 15 seconds total;
power POSTs are bounded to five seconds. Sleep/shutdown gets one 1.5-second attempt.
An opposite transition aborts prior work. Signals reach fetch, and wall-clock
checks prevent dispatch after a delayed resolution. Partial group failures do not
retry the whole group. Manual input/commands cancel pending overlap until the next
event; already accepted cloud commands cannot be recalled.

## Limits and verification

Event receipt cannot guarantee cloud delivery before suspension/shutdown. Wi-Fi,
process ordering, platform policy, Modern Standby and forced power loss remain
limits. No OS transition is blocked or delayed. Read the
[configuration, policy and manual matrix](../verification/377-power-lifecycle.md).
Actual hardware and real machine sleep/shutdown tests remain unverified; automated
native smoke/routing checks do not claim physical transition validation.

Primary references:
- [Elgato system wake](https://docs.elgato.com/streamdeck/sdk/v2/guides/system/)
- [Apple NSWorkspace events](https://developer.apple.com/documentation/appkit/nsworkspace)
- [Windows power notifications](https://learn.microsoft.com/en-us/windows/win32/power/wm-powerbroadcast-messages)
- [Windows suspend window](https://learn.microsoft.com/en-us/windows/win32/power/pbt-apmsuspend)
- [Govee power control endpoint](https://developer.govee.com/reference/control-you-devices)
