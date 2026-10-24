# Elgato MCP smoke check — 2026-10-22

Scope: live macOS Stream Deck host through the Elgato bridge. This is partial
coverage of K1 in [the hardware plan](stream-deck-test-plan.md), not a full pass.
The running build commit was not established by this check.

| Check | Observation |
| --- | --- |
| Bridge connection | Stream Deck connected; action enumeration and execution available. |
| Configured Govee actions | On / Off, Brightness and Color, each titled Desk light. |
| Native state metadata | All three report two states. This does not verify rendered artwork. |
| First On / Off execution | Bridge returned `ok`; plugin logged `originalState: false`, `command: on` at 18:01:05.796 UTC, followed by `light.power.verify` at 18:01:06.004 UTC. |
| Second On / Off execution | Bridge returned `ok`; plugin logged `originalState: true`, `command: off` at 18:01:12.194 UTC, followed by `light.power.verify` at 18:01:12.454 UTC. |

The second command observed an on state after the first command. The command
sequence requested restoration of the initial off state. Physical light output
and final physical state were not independently observed. Verification log
presence alone is not an assertion that verification succeeded.

On / Off host state remained 0 in the intermediate enumeration. That is
compatible with the default use-state-0 artwork setting; the setting itself was
not exposed and no artwork conclusion can be drawn.

Brightness and Color were enumerated but not executed. The exposed MCP tools
cannot edit settings, inspect artwork/LCD rendering, rotate encoders, switch dial
stacks, or simulate OS sleep/wake. Those plan cases remain Not run. No Windows
or physical hardware visual validation was performed.
