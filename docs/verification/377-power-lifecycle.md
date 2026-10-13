# PC power automation (#377)

Configure account-level rules in **On / Off → PC power → Light automation**.
Automation is disabled by default. Existing bindings, schedules and manual
commands retain their behavior. Each saved rule addresses one light or group;
up to 100 rules are supported. Rules continue when their editor key is hidden
or removed. Delete the rule explicitly to remove it.

## Configure

1. Select a supported light/group in the normal Device selector.
2. Open Light automation. Choose the current selection or an existing saved rule.
3. Check Enable and the desired events, then **Save rule**:
   - On when the plugin starts (also fires on Stream Deck/plugin restart).
   - On when the PC wakes (requires Stream Deck/plugin to be running).
   - Off before sleep (starts an OS event observer).
   - Off before shutdown/logout (**best effort**).
4. Use Refresh status to confirm the observer is ready. Disable and save the rule,
   or Delete rule, to stop it. Editing checkboxes alone sends no commands.
5. To manage a rule for a deleted/unavailable light, choose it from Saved rules.
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

- Commands explicitly set On/Off; they never toggle. Equivalent saved target IDs
  are deduplicated. Repeated start/wake or off events are coalesced per target
  within five seconds; opposite transitions cancel prior work.
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
