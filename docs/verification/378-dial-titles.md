# Brightness dial target titles (#378)

Brightness and legacy Brightness Dial show the selected light/group name above
brightness and the bar. Unconfigured dials show “Select a light”; unresolved
configured targets show “Light unavailable”. Default names longer than 24 Unicode
code points are shortened with an ellipsis. Renames appear after the discovery
cache refreshes; switching target refreshes the header through the existing sync.
Keypad behavior and saved target settings are unchanged.

The layout uses the SDK's special `title` item. A title entered in Stream Deck
has precedence over the plugin's default name and can distinguish otherwise
identical or truncated names. Other dials retain their current layouts.

References: [Elgato dials guide](https://docs.elgato.com/streamdeck/sdk/guides/dials/)
and installed `@elgato/streamdeck` 2.1.0 `api/layout.d.ts` / `plugin/actions/dial.d.ts`.
The host renders the active stack action's feedback; there is no separate
stack-title API in the installed SDK.

## Manual verification (macOS and Windows, Stream Deck+)

1. Add two Brightness actions to a dial stack, selecting different lights.
2. Cycle the stack; each selected action must show its own name, brightness, bar.
3. Set a native custom Title on each stack action. Check it overrides the name.
4. Clear custom titles; select a group, an unconfigured target, and a long name.
5. Rename a light in Govee Home (or rename a saved group), refresh state and wait
   for discovery; verify the new name. Switch target and confirm no old name persists.
6. Rotate, press, and touch the dial. Verify brightness and power behavior.
   Test mixed group power/brightness and a failing member; check existing mixed
   values and command warning feedback remain present.
7. Repeat on a legacy Brightness Dial and a Brightness keypad binding.

Hardware and Windows host behavior have not been verified in this implementation
environment. Unit tests exercise real action handlers with mocked SDK/API boundaries;
Playwright checks the shipped manifest/layout contract, not the Stream Deck host.

Release note: Brightness dials identify the selected light or group and support
native custom titles, including use in dial stacks.
