# Separate On/Off artwork (#375)

The On / Off action supports Stream Deck's native two-state icon editor.
No custom image setting, remote URL, image reader, or migration of plugin settings
is needed. The host validates and persists selected images, including profile
export/import. Each manifest state retains the original default artwork.

## Set your icons

1. Select an On / Off key in Stream Deck and choose **Toggle** in its Operation
   setting to follow live power state.
2. In Stream Deck's key artwork editor, select the **On** state (state 0).
   Open its image menu and choose **Set from File**, or drag your artwork onto
   that state's image preview.
3. Select **Off** (state 1) and set the second image the same way.
4. Press the key: all-off uses Off; any-on (including a mixed group) uses On.
   To restore a state's shipped artwork, use the host's **Reset to Default**.

The plugin disables automatic host toggling and selects states from live power
rather than the number of key presses. A failed command retains the previous
state and shows the existing alert. Before a live sample is available, the existing off fallback selects state 1.
A failed refresh retains the last known state. Fixed On and Off operations use their corresponding
artwork state and keep their existing command semantics. The Operation setting
remains authoritative in Multi Actions; adding icon states does not reinterpret
existing commands based on host state payloads.

Native custom icons take precedence over plugin-rendered artwork. A custom icon
therefore hides the plugin's image badge for that state; group counts and failure
banners still use the existing title (which a native custom title can override).
If only one icon is customized, the other state uses the original artwork and
badge. No icons configured means the same default appearance as before.

Source: [Elgato multi-state keys and image precedence](https://docs.elgato.com/streamdeck/sdk/guides/keys/)
and installed SDK 2.1.0 `plugin/actions/key.d.ts` / manifest schema.

## Manual verification (macOS and Windows)

- Start with an existing single-state key/profile containing custom artwork;
  upgrade to this build. Verify the original state-0 artwork persists and check
  the newly added state-1 default. Save distinct artwork in both states.
- Test neither / On only / Off only / both custom images. Cycle On→Off→On;
  refresh state, restart Stream Deck, export/import the profile. Check persistence.
- Try unsupported or unavailable image files in the host editor; confirm rejection
  or the host's fallback without affecting light commands.
- Test a mixed group, all-off group, failed member, and total API rejection.
  Check state selection, group count, warning, and default badge where visible.
- Test unknown/missing target/API key, fixed On/Off commands, and existing Multi
  Actions. Command meaning must continue to come from Operation.
- Configure a native custom title too; verify normal host precedence.

Automated tests verify actual action handlers and the manifest contract.
The host's image picker, persistence/migration, and rendering precedence are
SDK-supported behavior requiring the manual checks above; neither Windows nor
Stream Deck hardware was tested here.

Release note: Choose separate On and Off icons for power keys using Stream Deck's
native state artwork editor. Default icons and existing light commands are retained.
