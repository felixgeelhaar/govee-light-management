# PC power lifecycle automation (#377) — design for review

Status: proposal only. No automation or native process has been shipped by this
PR. Full sleep/shutdown support requires native integration; implementation is
paused for the requested design review. Recommended first scope: opt-in plugin
start and SDK wake only, with sleep/shutdown explicitly unsupported.

## Evidence and event sources

| Event | macOS | Windows | Plugin-only feasibility |
| --- | --- | --- | --- |
| Plugin start | after `streamDeck.connect()` resolves | same | Observable, but also fires on plugin/app restart, not proof of PC boot |
| System wake | SDK `system.onSystemDidWakeUp` | same | Supported while Stream Deck/plugin is running |
| Sleep | native `NSWorkspace.willSleepNotification` | native `WM_POWERBROADCAST` / `PBT_APMSUSPEND` | Not exposed by SDK 2.1.0 |
| Shutdown/logout | native `NSWorkspace.willPowerOffNotification` | native session-end notifications | No reliable SDK event or guaranteed cloud delivery |
| Forced shutdown/power loss | no usable command window | same | Unsupported |

Installed `@elgato/streamdeck` 2.1.0 `plugin/system.d.ts` exposes wake,
application launch/terminate and deep links, but no sleep/shutdown event.
[Elgato's system guide](https://docs.elgato.com/streamdeck/sdk/v2/guides/system/)
also documents wake-triggered `willAppear` events: **do not** interpret action
appearance/disappearance as PC power transitions or register one wake handler
per visible action. Profile changes, stack navigation and unplugging can trigger
those events too.

`plugin.ts` currently starts SchedulerService and registers SIGTERM/SIGINT
cleanup through `services/lifecycle.ts`. Those process signals also mean plugin
unload/restart and cannot establish OS shutdown. Existing scheduling is daily,
weekly or delay based; it has no PC-power trigger. Manifest supports macOS and
Windows. No existing native helper, installer or power-event adapter was found.

Apple documents [sleep notification](https://developer.apple.com/documentation/appkit/nsworkspace/willsleepnotification)
and [NSWorkspace events](https://developer.apple.com/documentation/appkit/nsworkspace).
Windows documents [WM_POWERBROADCAST](https://learn.microsoft.com/en-us/windows/win32/power/wm-powerbroadcast-messages)
and a roughly two-second suspension window in
[PBT_APMSUSPEND](https://learn.microsoft.com/en-us/windows/win32/power/pbt-apmsuspend).
Event observability does not guarantee network availability or command completion.

## Proposed configuration and behavior

Persist account-level rules in global settings, independent of visible keys:
`{ id, enabled: false, selectedDeviceId, onPluginStart: false, onWake: false,
manualOverridePolicy: "untilNextEvent" }`. Reuse existing `light:id|model` and
`group:id` target encoding and PI capability-filtered target selectors. Do not
store API keys in rules or action settings. All old settings imply disabled.
Show “when Stream Deck/plugin starts”, not “when PC boots”.

A later companion may add `offBeforeSleep` and `offBeforeShutdown`, disabled by
default and labeled best effort. Do not expose actionable unsupported controls
in the first UI. Changing rules must not issue commands immediately.

Default manual policy: a manual command wins until the next enabled event;
there is no polling or periodic enforcement. Every enabled event issues explicit
`on` (or later `off`), never `toggle`, so duplicates are idempotent. Do not offer
“preserve all manual overrides” without a persisted pause mechanism: discovering
an off light alone cannot distinguish manual intent from a stale cloud sample.
A user can disable a rule to preserve manual control across future events.

Deduplicate same-target rules and serialize each target; coalesce duplicate
start/wake events within five seconds. Take a configuration generation snapshot;
disable/retarget/unload cancels pending work and discards stale completions.
Register one process-wide SDK listener and dispose it on unload through the
existing shutdown runner. Own timers centrally and clear them during shutdown.
No child process or polling is needed for start/wake.

After connection, load global rules and resolve the API key with existing global
settings. Skip disabled/missing-key rules without network calls. Resolve targets
through ActionServices and reuse domain commands and full-group fan-out; do not
filter on Govee's online flag. Report actual partial outcomes in structured logs,
without key/title feedback for actions that may be hidden.

## Timeouts and retries — required implementation gate

Wake/start can race Wi-Fi reconnect. Proposal: one initial attempt plus one retry
three seconds later for transient network errors only, at most 15 seconds total;
no retry for invalid key, validation, missing target or rate limit. Recheck rule
generation before dispatch and retry. Partial success must not be retried as a
whole group. Manual input must cancel pending retry for the same target.

Current ActionServices control retries and client retry middleware layer together;
a `Promise.race` timeout alone does **not** cancel a cloud request. Before enabling
this automation, inspect and test transport cancellation/AbortSignal support in
sibling `govee-api-client`. Add a bounded request budget at that boundary if needed,
then update the plugin dependency. Do not disguise late requests as cancelled.

Sleep/shutdown: no indefinite retry, no delay/veto of OS transition, deadline
below the OS notification window, discard expired work so it cannot turn lights
off after resume. Network can disappear before a command reaches Govee. Forced
shutdown, app already closed, crashes and power loss cannot be guaranteed.

Logs: event, rule ID, target ID/model, category, duration and member outcome only;
never serialize global settings, request headers, raw Axios causes or credentials.
Classify missing key/target, auth, rate limit, timeout/network, validation and
partial group failures separately. No startup error should block Stream Deck.

## Native companion assessment (separate opt-in scope)

- macOS: signed/notarized helper using NSWorkspace's own notification center and
  an appropriate run loop; evaluate user-session agent lifetime and logout races.
- Windows: signed helper with the appropriate power/session notifications and
  message loop; verify Modern Standby, hibernate, lock and user-session behavior.
- Prefer a separate opt-in companion over introducing platform binaries into
  the existing pure Node plugin. Require explicit installation/consent and clear
  disable/uninstall controls; no admin/service installation by default.
- Assess architectures, signing credentials, notarization, updater, crash cleanup,
  authenticated local IPC, and Marketplace packaging with Elgato before committing
  to distribution. A plugin-launched helper stops when the plugin does; a separate
  user-session agent adds support burden. Keep API credentials in the plugin and
  send event data only over a private authenticated local channel.

## Review and verification gates

Approve either SDK start/wake-only scope or a separately assessed companion.
Then implement with failing tests first: disabled/default settings, startup,
wake duplicates, rule changes, manual override and retry cancellation, missing
API key/target, auth/network timeout, group partial success and unloading cleanup.
Mock event adapters, run real transport cancellation tests, and retain scheduler
and manual-control regression suites.

Manual matrix: macOS and Windows, PC boot with Stream Deck auto-start on/off,
plugin restart, real sleep/wake/hibernate, repeated events, Wi-Fi recovery/loss,
manual override, multiple profiles/stacks and hidden rules. For a companion,
verify notification receipt and deadlines, signing/consent/uninstall and no
leaked processes. No real-machine lifecycle tests have been performed here.

Release note draft for a future implementation: “Optional rules can turn selected
lights/groups on when the plugin starts or the PC wakes. Sleep/shutdown power-off
is not supported by the plugin alone.” This design PR is not a feature release
and does not satisfy #377's implementation acceptance criteria.
