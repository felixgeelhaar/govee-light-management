# Automation (#377)

Configure account-level rules in **On / Off → Automation → Manage rules**.
Automation is disabled by default. Existing bindings, schedules and manual
commands retain their behavior. Each saved rule addresses one light or group;
up to 100 rules are supported. Rules continue when their editor key is hidden
or removed. Delete the rule explicitly to remove it.

## Configure

1. Select a supported light/group in the normal Device selector.
2. Open Automation → Manage rules. The rule targets the light/group selected above;
   Target shows its name. Use Edit on a saved rule to manage another target.
3. Check Enable and at least one desired event, then **Save rule**. Enable alone
   does not select an event; an enabled rule with no events is saved but clearly
   marked inactive:
   - **Turn On → Plugin starts** (also fires on Stream Deck/plugin restart).
   - **Turn On → Computer wakes** (requires Stream Deck/plugin to be running).
   - **Turn Off → Before sleep** (starts an OS event observer).
   - **Turn Off → Before shutdown / logout** (**best effort**).
4. Use Refresh status to confirm the observer is ready. Disable and save the rule,
   or Delete rule, to stop it. Editing checkboxes alone sends no commands.
5. To manage a rule for a deleted/unavailable light, use Edit or Delete on its saved rule.
   Selecting a saved rule in this editor does not retarget the key itself.

A macOS JXA/AppKit observer or Windows PowerShell/.NET observer runs only when an
enabled rule requests sleep/shutdown. They use the OS's notification APIs, not
power-state polling. No administrator service, login agent, policy change or
separate installation is performed. No API keys or device identifiers are sent
to either helper. Hardened OS policies can prevent the Windows observer from
starting; the PI reports unavailable and SDK startup/wake support still works.

Sleep/shutdown delivery cannot be guaranteed: the host/plugin may stop first,
Wi-Fi/cloud access may disappear, Modern Standby may omit expected notifications,
and forced shutdown/crashes/power loss provide no reliable command window. The
plugin does not delay or veto an OS transition. macOS logout/power-off and Windows
session-ending notifications use the shutdown rule; display sleep/lock, profile
changes and USB disconnects are not PC power transitions.

## Command and override policy

- Lights with LAN Control on are switched over the local network first
  (`LanFirstPowerClient`): a `turn` command, then a status read with a 500 ms
  limit. If the light confirms, no cloud request is made; otherwise the bounded
  cloud POST below runs. Before sleep this is the difference between a command
  sent in about 1 ms and a cloud round trip of about 700 ms that sleep often cut
  off. Automation waits up to 3 s for the first LAN scan, so "Plugin starts" rules
  can use LAN too. Each light logs `lifecycle.power` with `transport: lan | cloud`.
- Commands explicitly set On/Off; they never toggle. Equivalent saved target IDs
  are deduplicated. Repeated start/wake or off events are coalesced per target
  within five seconds; opposite transitions cancel prior work.
- A wake event runs wake rules only if the computer was actually suspended.
  Stream Deck also reports a display wake as `systemDidWakeUp` (observed on
  macOS 2026-10-24 with no system sleep). `SuspensionDetector` ticks every 5 s;
  a wall-clock gap more than 15 s past a tick counts as a suspension, and a wake
  within 120 s of one is honoured. Otherwise the log records
  `wake_ignored_not_suspended`. A sleep shorter than about 15 s may not count.
- Startup/wake gets at most 15 seconds total and one retry after three seconds
  for a transient power-request network/timeout error. Individual POSTs have a
  five-second deadline. Auth, validation, rate-limit and partial-group failures
  are not retried. Sleep/shutdown gets one attempt within 1.5 seconds total.
- Saved device ID/model references and locally stored groups are used for power
  commands; cloud inventory discovery is not a prerequisite. Govee validates the
  actual command. Group references are prepared while awake and invalidated on
  group/configuration/credential changes. No periodic enforcement is added.
- Using a key/dial for a target, or sending another control command, cancels its
  pending automatic work/retry until the next enabled power event. A group-member
  command also cancels overlapping group work. Unknown pending group membership
  is handled conservatively. Already accepted cloud commands cannot be recalled.
- Disable/retarget/unload and wake after sleep cancel obsolete requests. The
  AbortSignal reaches the actual HTTP request; late resolutions cannot dispatch.
  Wall-clock expiry is checked after awaits, including when a process was paused.
- Every group member is attempted regardless of the cloud online hint. Partial
  success keeps successful updates and logs counts; an unreachable member does
  not discard work that reached other members.

Rules contain event booleans and target IDs only, never API keys. Writes read the
latest settings successfully before preserving account credentials/groups; a
failed storage read aborts the write. Automation logs use `power.lifecycle` and
allowlisted event/target/category/count fields, without raw errors, headers or
API response bodies. Device IDs are personal identifiers; inspect logs before
sharing them.

## Manual verification (macOS and Windows)

1. With all rules disabled, restart Stream Deck. Confirm no power changes and no
   observer process (`osascript` / `powershell.exe`) spawned for the feature.
2. Save a startup/wake rule for a light, then a group. Restart the plugin; check
   startup is honored only when selected. Change profiles/hide/delete the editor
   key; the saved rule remains active. Verify saved-rule editing/deletion.
3. Enable sleep/shutdown and Refresh status. Confirm ready. Perform actual
   sleep/wake; check Off was attempted before sleep, On after wake, and duplicate
   notifications do not create repeated bursts. Repeat with hibernate/Modern
   Standby, logoff and a normal shutdown/restart; record unsupported/missed cases.
4. Turn a light off manually during a failed wake request/retry. Confirm it stays
   off until another enabled event. Test group-member overrides and other actions.
5. Remove the API key, delete a target/group, disconnect the network, and make one
   group member unreachable. Confirm bounded skips/errors and partial outcomes;
   shutdown must continue. Restore connectivity and test the next enabled event.
6. Disable rules while work is pending. Restart/unload/force-stop the plugin and
   confirm helper cleanup; editing/deleting a group cancels obsolete membership.
7. Repeat existing key/dial brightness, power, custom artwork and schedule checks.

Automated verification exercises real action/service logic, the actual HTTP abort
against localhost, browser rule persistence messages, and packaged native helper
startup/pipe cleanup on supported test platforms. macOS tests additionally post
private in-process AppKit notifications; they do **not** sleep/shut down the real
machine. Real Stream Deck/Govee hardware and real-machine power transitions remain
manual checks. Windows helper runtime validation is performed by Windows CI.

Release note: Optional account-level light/group rules follow plugin startup and
PC wake, with opt-in best-effort Off before sleep/shutdown. Manual control takes
priority over pending automation; existing installations remain disabled.

## Maintainer test finding (2026-10-17)

A reported failure to turn on was investigated on the installed DEV candidate.
The inspector showed Enable checked, but startup, wake, sleep and shutdown all
unchecked. No lifecycle command outcome appeared in the recent DEV logs. This
configuration has no matching event and therefore sends no power command. The
inspector now distinguishes this inactive saved rule from an active rule and
from a disabled rule. No events are enabled implicitly. A startup/wake hardware
success has not yet been confirmed by this observation.

## Inspector appearance

Automation → Manage rules uses the same disclosure and 95px/241px label/value
columns as the existing Groups editor. Target, checkboxes and buttons use the
bundled native SDPI components. No automatic settings bindings are attached to
the rule controls: Save/Delete remain explicit, preserving opt-in behavior.
Turn On and Turn Off group the event choices, with short persistence and
best-effort notes and an aligned status area. The editor is checked at a 370px
viewport for horizontal overflow and collapse/expand behavior. Programmatic
target rendering must not create a new load loop.

### Saved-rule feedback

Automation follows the Groups inspector styling. Its summary shows the saved rule
count; the list shows each target, enabled/disabled/inactive state and selected
events. Names come from the existing device/group catalog, with saved identifiers
as a fallback if unavailable. Each entry has Edit and Delete controls. Edit loads the saved rule without
changing the key's target. The editor shows Create rule for a new target and Save
changes for an existing rule; confirmed creation adds an entry and deletion removes it. Only confirmed responses update the list. Save/Delete show pending and
success/error feedback; a failed request preserves the last confirmed list.

Manual check: open Automation, select a target, enable Startup and save. Confirm
`Manage rules · 1` and the target's `Enabled · Startup` row. Select Edit, disable
and Save changes; confirm Disabled. Use Delete on the entry and confirm the empty
list and deletion message.
Repeat with a group, a long/renamed target and multiple saved rules. Real machine
startup/sleep/wake validation remains outstanding.

### Consistent group editor

Groups uses the same native SDPI buttons, saved-entry rows, count summary and
persistent feedback as Automation. New group opens the Name/Lights form. Create
group adds an entry; Edit loads its name and membership, and Save changes updates
the same ID so existing keys and automation references remain valid. Delete stays
on each entry with its existing confirmation. Members absent from the current
catalog remain selected and visible as unavailable until explicitly removed.

Manual check: create a two-light group, edit its name and remove one member, then
verify a key and an automation targeting that group still address the same group.
Cancel must not save; Delete must remove the entry after confirmation. Check the
layout on another action inspector as Groups is shared across all inspectors.

### Removed status dot

The corner status dot and its global Show/Hide control have been removed from
all inspectors. Old saved `showStatusBadge` values are ignored, without deleting
unrelated settings. Power-state artwork and existing command/group feedback are
preserved. Native custom artwork continues to take precedence over plugin images.
Verify no Status dot field is present and state artwork remains distinct for
On/Off/mixed states; native state switching is delivered separately in #381.

## Sleep-off investigation (October 2026 follow-up)

The reporter confirms wake-on works but sleep-off does not. Their OS and fresh
logs are still required; this change does not claim to fix that hardware failure.
The existing AppKit/SystemEvents observers do not negotiate a pre-suspend delay.
Adding a signed native helper or OS sleep inhibitor requires a separate design
review covering consent, packaging, bounded acknowledgement and cleanup. No
sleep inhibitor, new permissions or background service is introduced here.

After testing this candidate, record OS/version, plugin version, whether the
observer reports Ready, the wall-clock time of one actual sleep/wake, and sanitized
`power.lifecycle` lines around it. Do not share API keys or the entire log blindly.
The logger timestamps each record. Interpret the sequence as follows:

- No `event_received` for `sleep`: notification delivery to the plugin has not
  been demonstrated. Observer Ready proves startup only.
- `event_received` without `command_started`: rule filtering, duplicate suppression,
  credentials, target resolution or interruption occurred before dispatch. Check
  the following `missing_key`, `missing_target`, failure or `timeout` categories.
- `command_started` without `ok`/`partial`: dispatch was attempted but completion
  is unconfirmed. A paused process/network loss can prevent completion logging.
- `ok`/`partial`: the API request returned successfully for all/some members; this
  is not independent proof of the physical light state.

On macOS and Windows, repeat once with a single light and once with a group.
Compare actual sleep with display-off/lock, which are intentionally unsupported.
No real-machine suspend or Windows hardware result is claimed by this patch.
