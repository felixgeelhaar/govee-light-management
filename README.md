# Govee Light Management for Stream Deck

<div align="center">

![Stream Deck Plugin](https://img.shields.io/badge/Stream%20Deck-Plugin-blue?style=flat-square&logo=elgato)
![Version](https://img.shields.io/badge/version-2.8.0-green?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0+-blue?style=flat-square&logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-20+-green?style=flat-square&logo=node.js)

**Control your room's Govee lighting without ever leaving what you're working on.**

One press for a saved look. One rotation for the perfect brightness. Status visible at a glance. The phone stays in your pocket.

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Contributing](#contributing) • [License](#license)

</div>

## Features

### 🎛️ **Individual Light Control**

- Toggle lights on/off with visual state indicators
- Adjust brightness, color, color temperature, and saturation
- Real-time state synchronization with your lights
- Every Govee device the Cloud API exposes; each action only offers the lights
  that support it

### 👥 **Group Management**

- **Create** groups from a light checklist, in any light-control Property Inspector
- **Delete** groups with a confirmation prompt
- **Shared** across every action — create a group once and it appears in every device dropdown
- **Visual indicators** for group states (●/○/◐)
- To change a group's membership, delete it and create it again

### 🎛️ **Hybrid Keypad + Stream Deck+ Encoder Actions**

As of v2.7.0 the **Brightness, Color, Color Temperature, Segment Color**,
and **Saturation** actions ship as a single hybrid action each — drag the
same action onto a Stream Deck key for a fixed-value press, or onto a
Stream Deck+ dial to rotate-adjust + press-to-toggle. One UUID, one
configuration, status indicator stays consistent across both controllers.

- **Brightness** — set fixed % on press, rotate ±step on dial
- **Color** — set fixed colour on press, rotate hue on dial (with configurable saturation)
- **Color Temperature** — set fixed Kelvin on press, rotate warm/cool on dial
- **Segment Color** — apply rainbow / gradient / solid preset across a segment range on press, rotate single-segment hue on dial
- **Saturation** — set fixed saturation on press, rotate ±step on dial
- **Visual Feedback** — real-time bar indicators on the dial LCD, multi-state icons + ●/◐/○ status badge on keypad titles
- **Configurable Steps** — customise sensitivity for each dial action
- **Power Toggle** — press any dial to toggle light power on/off
- **Group Support** — all hybrid actions work with light groups; partial failures show a persistent `⚠ N/M` banner

> **Legacy actions** — the standalone _Brightness Dial_, _Color Hue Dial_,
> _Color Temperature Dial_, and _Segment Color Dial_ entries are still
> registered (now labelled _(legacy)_) so existing user bindings keep
> working without touching them. New keys should use the unified actions
> above. The legacy entries will be removed in a future major release.

### ✨ **Recall — one button per look (new in v2.7.0)**

The **Recall** action picks from every Govee dynamic scene, DIY scene,
and snapshot the device exposes — in a single dropdown. Drag onto a key,
pick "Sunset" / your custom DIY mood / a saved snapshot → press to
apply. Replaces juggling separate Scene + Snapshot atomic actions for
the same job.

### 🎨 **Professional UI**

- Custom Stream Deck dark theme with SDPI framework
- Responsive form controls and accessibility compliance
- Intuitive Property Inspector interface
- Real-time status updates and error handling

### 🏗️ **Enterprise Architecture**

- Domain-driven design (DDD) with clean architecture
- Comprehensive TypeScript implementation
- Robust error handling and state management
- WebSocket communication for real-time updates

## Dials Demo

Check out the **[Stream Deck+ Dials Guide](docs/DIALS_GUIDE.md)** for comprehensive documentation with real-world scenarios, configuration tips, and troubleshooting.

**Quick overview** (drag the unified actions onto a SD+ dial):

- **Brightness** — dim/brighten with tactile control
- **Color Temperature** — switch from warm to cool white
- **Color** — paint your room with any color (360°)
- **Saturation** — control color intensity (white ↔ vibrant)
- **Segment Color** — per-segment RGB strip control

> The standalone `*-Dial (legacy)` entries are kept around for existing
> bindings only. All new dial setups should use the hybrid actions above.

📸 **Screenshots and demo videos** available in the [Gallery](docs/gallery/)

## Installation

### Prerequisites

- [Stream Deck Software](https://www.elgato.com/en/gaming/downloads) (v6.0 or later)
- [Node.js](https://nodejs.org/) (v20.0 or later)
- Govee API Key (obtainable from [Govee Developer API](https://developer.govee.com/))

### Option 1: Install from the Elgato Marketplace

Search for **Govee Light Management** in the [Elgato Marketplace](https://marketplace.elgato.com/search?query=govee%20light%20management) and install it from there. This is the recommended route.

### Option 2: Build and install from source

1. **Download the latest release**

   ```bash
   # Clone the repository
   git clone https://github.com/felixgeelhaar/govee-light-management.git
   cd govee-light-management
   ```

2. **Install dependencies and build**

   ```bash
   npm install
   npm run build
   ```

3. **Pack it, then open the result**

   ```bash
   npm run streamdeck:pack
   ```

   Double-click `dist/com.felixgeelhaar.govee-light-management.streamDeckPlugin`
   and Stream Deck will install it.

   To work on the plugin instead of installing a release copy, link the source
   folder directly — see [Separate DEV Plugin Workflow](#separate-dev-plugin-workflow).

4. **Restart Stream Deck**
   - Quit Stream Deck completely
   - Restart the application
   - The plugin will appear in your actions list

## Usage

### Getting Started

1. **Obtain Govee API Key**
   - Visit [Govee Developer API](https://developer.govee.com/)
   - Sign up and create an API key
   - Save your API key securely

2. **Add an action to a key or a dial**
   - Drag the action for the job you want onto a Stream Deck key, or onto a
     Stream Deck+ dial
   - Enter your Govee API key in the Property Inspector. It is stored once and
     shared by every action, so you only do this on the first one.

### Choosing an action

There is no single "light control" action with a mode dropdown. Each job has
its own action, so a key does one thing and its icon says which:

| Action                | What a key press does                                             |
| --------------------- | ----------------------------------------------------------------- |
| **On / Off**          | Turn on, turn off, or toggle                                      |
| **Brightness**        | Set a fixed brightness (1–100%)                                   |
| **Color**             | Set a fixed colour from the hex picker                            |
| **Color Temperature** | Set a fixed warmth, within the range your light reports           |
| **Saturation**        | Set a fixed colour intensity                                      |
| **Segment Color**     | Apply a rainbow / solid / gradient preset across a segment range  |
| **Recall**            | Apply one saved look: a dynamic scene, a DIY scene, or a snapshot |
| **Scene**             | Apply one of the device's dynamic scenes                          |
| **Snapshot**          | Apply a snapshot you saved in the Govee app                       |
| **Music Mode**        | Switch the light into one of its music-reactive modes             |
| **Feature Toggle**    | Flip a device feature (gradient, nightlight, …) on or off         |
| **Schedule**          | Run a command on a daily, weekly, or delay trigger                |
| **Sequence**          | Run a chain of commands with configurable delays                  |
| **Custom Effect**     | Play an RGB animation on an IC strip                              |

Keys show live state in the title and as a badge on the artwork: ● on, ○ off,
◐ some members on.

### Selecting lights and groups

Every action's Property Inspector lists your individual lights and any groups
you have made in the same dropdown, and only offers lights that support what
the action does — a light with no segments never appears under Segment Color.

Groups are plugin-wide: create one in any light-control Property Inspector
under **Manage groups…** and it shows up in every action's dropdown.

- **Create** — expand **Manage groups…**, click **+ New Group**, name it, tick
  the lights, click **Create**
- **Delete** — click **✕** on the group row and confirm
- To change a group's membership, delete it and create it again

Applying an action to a group sends one command per light, all at once. If some
lights fail, the ones that succeeded keep their change and the key shows a
persistent `⚠ N/M` banner for 30 seconds.

### Stream Deck+ dials

**Note:** requires a Stream Deck+ or another device with encoders.

Drag **Brightness**, **Color**, **Color Temperature**, **Saturation**, or
**Segment Color** onto a dial — the same actions you would use on a key. On a
dial they behave as:

- **Rotate** — adjust the value by one step per tick
- **Press** — toggle the light's power
- **Display** — the light or group name and the current value
- **Feedback bar** — a plain bar for brightness and saturation, a warm→cool
  gradient for colour temperature, a rainbow for colour

Step size per tick is configurable in the Property Inspector:

| Dial              | Range   | Default |
| ----------------- | ------- | ------- |
| Brightness        | 1–25%   | 5%      |
| Saturation        | 1–25%   | 5%      |
| Color Temperature | 50–500K | 100K    |
| Color             | 1–90°   | 15°     |
| Segment Color     | 1–90°   | 15°     |

For a group, a colour-temperature dial spans the union of every member's
range, and each light stops at its own limit rather than the whole group being
capped by the narrowest one.

### Advanced Features

#### Real-time State Monitoring

- Buttons automatically update to reflect current light states
- Group indicators show combined state of all lights
- Error states are clearly communicated

#### API Key Management

- API keys are stored once in Stream Deck's global settings and shared by every action
- The key is format-checked before any API call is attempted
- Clear error messages for authentication issues

## Development

### Prerequisites for Development

```bash
# Install dependencies
npm install

# Install Stream Deck CLI globally
npm install -g @elgato/cli
```

### Development Workflow

Use the normal repo quality checks while developing:

```bash
# Run linting
npm run lint
npm run lint:fix

# Type checking
npm run type-check

# Run tests
npm test
npm run test:coverage

# Format code
npm run format
npm run format:check
```

For active plugin development, use either a manual rebuild loop or watch mode.

#### Manual rebuild loop

```bash
npm run dev:build
npm run dev:restart
```

#### Watch mode

```bash
npm run watch
```

Then in another terminal:

```bash
node scripts/patch-dev-build.mjs
npm run dev:restart
```

### Separate DEV Plugin Workflow

The repository supports running a separate DEV version of the plugin alongside the normal installed release version.

This means:

- you do not need to uninstall or delete the release plugin every time you want to work on the plugin locally
- the development build is linked as a separate Stream Deck plugin
- the release build stays untouched

The DEV plugin uses a separate UUID and display name at build time only. Source files stay in production form.

#### One-time setup

```bash
# Enable developer mode in Stream Deck
streamdeck dev

# Build and link the DEV plugin
npm run dev:link

# Start or restart the DEV plugin
npm run dev:restart
```

#### Day-to-day DEV workflow

After making code changes:

```bash
npm run dev:build
npm run dev:restart
```

This rebuilds the plugin, creates a DEV copy of the `.sdPlugin` bundle, patches the DEV UUID and manifest metadata, and restarts the DEV plugin in Stream Deck.

#### What the DEV workflow does

The DEV build process:

- builds the normal plugin output
- copies it to a separate folder:
  `com.felixgeelhaar.govee-light-management.dev.sdPlugin`
- changes the plugin UUID to:
  `com.felixgeelhaar.govee-light-management.dev`
- changes the plugin name and category so it appears separately in Stream Deck
- keeps the release plugin installed and usable

#### Useful DEV commands

```bash
# Build release output, then create DEV plugin output
npm run dev:build

# Link the DEV plugin into Stream Deck
npm run dev:link

# Restart the DEV plugin
npm run dev:restart

# Unlink the DEV plugin
streamdeck unlink com.felixgeelhaar.govee-light-management.dev

# Stop the DEV plugin
streamdeck stop com.felixgeelhaar.govee-light-management.dev
```

#### Stream Deck CLI Workflow

This project uses the official Stream Deck CLI for local development and packaging.

```bash
# Enable developer mode
streamdeck dev

# Validate the release plugin
streamdeck validate com.felixgeelhaar.govee-light-management.sdPlugin

# Pack the release plugin
streamdeck pack com.felixgeelhaar.govee-light-management.sdPlugin -o dist
```

Or with the repo scripts:

```bash
npm run streamdeck:dev
npm run streamdeck:validate
npm run streamdeck:pack
```

### Release Workflow

When preparing a real release build:

```bash
npm run lint
npm run type-check
npm test
npm run build
streamdeck validate com.felixgeelhaar.govee-light-management.sdPlugin
streamdeck pack com.felixgeelhaar.govee-light-management.sdPlugin -o dist
```

Install the packaged release plugin from:

```text
dist/com.felixgeelhaar.govee-light-management.streamDeckPlugin
```

### Recommended Workflow Summary

#### For normal development

```bash
npm run dev:build
npm run dev:restart
```

#### For code quality checks

```bash
npm run lint
npm run type-check
npm test
```

#### For packaging a release

```bash
npm run build
streamdeck validate com.felixgeelhaar.govee-light-management.sdPlugin
npm run streamdeck:pack
```

### Project Structure

```
govee-light-management/
├── src/
│   ├── backend/                  # everything that runs in the plugin process
│   │   ├── actions/              # Stream Deck action classes (+ shared/)
│   │   ├── application/          # DeviceService and orchestration
│   │   ├── connectivity/         # transport abstraction + cloud transport
│   │   ├── domain/               # entities, value objects, repository interfaces,
│   │   │                         # domain services — no external dependencies
│   │   ├── infrastructure/       # Govee client + Stream Deck storage adapters
│   │   ├── services/             # scheduler, sequences, effects, settings, telemetry
│   │   └── plugin.ts             # entry point
│   └── shared/types/             # types shared with Property Inspector payloads
├── com.felixgeelhaar.govee-light-management.sdPlugin/
│   ├── manifest.json
│   ├── ui/                       # Property Inspectors: hand-written HTML + js/setup.js
│   ├── imgs/                     # per-action artwork
│   └── bin/                      # build output
├── test/                         # Vitest unit tests + test/e2e Playwright specs
└── docs/
```

### Architecture

This plugin follows **Domain-Driven Design (DDD)**, with the layers as real
directories under `src/backend/`:

- **Domain** (`domain/`): entities, value objects, repository interfaces, and
  pure domain services. No SDK, no HTTP.
- **Application** (`application/`): orchestration over the domain — device
  discovery, caching, capability normalization.
- **Infrastructure** (`infrastructure/`): the adapters that implement the
  domain's repository interfaces against the Govee API client and Stream Deck's
  settings storage.
- **Actions** (`actions/`): the Stream Deck entry layer. Receives SDK events,
  delegates, and owns presentation.

Dependencies point inward: an action may reach infrastructure, the domain never
reaches outward.

The Property Inspectors are plain HTML with a shared `ui/js/setup.js` and
Elgato's SDPI web components — there is no frontend framework and no frontend
build step.

### Testing

```bash
# Unit tests
npm test

# Coverage report
npm run test:coverage

# E2E tests (Playwright, against the Property Inspector HTML)
npm run test:e2e
```

## API Reference

### Govee API Integration

This plugin uses the [@felixgeelhaar/govee-api-client](https://www.npmjs.com/package/@felixgeelhaar/govee-api-client) library for Govee API interactions.

**Supported Operations:**

- Get device list
- Get device state
- Control device power
- Set brightness (1-100%)
- Set color (RGB)
- Set color temperature (within each light's supported range)

**Rate Limiting:**

- Respects Govee API rate limits (100 requests/minute)
- Implements exponential backoff for failed requests
- Queues multiple operations to prevent API throttling

## Troubleshooting

### Common Issues

**Plugin not appearing in Stream Deck**

- Ensure Stream Deck software is v6.0 or later
- Restart Stream Deck completely after installation
- Check plugin is properly built: `npm run build`

**API Key not working**

- Verify API key from [Govee Developer Console](https://developer.govee.com/)
- Ensure API key has proper permissions
- Check network connectivity and firewall settings

**Lights not responding**

- Verify lights are online in Govee Home app
- Check if lights support API control (newer models)
- Ensure lights are on same network as computer

**Group operations failing**

- Verify all lights in group are online
- Check for API rate limiting (too many requests)
- Ensure group hasn't been deleted by another device

### Debug Logging

Enable debug logging in Stream Deck Console:

1. Open Stream Deck software
2. Help → Open Stream Deck Console
3. Filter by "govee-light-management"
4. Check for error messages and API responses

### Getting Help

- 📖 Check [Wiki](https://github.com/felixgeelhaar/govee-light-management/wiki) for detailed guides
- 🐛 Report bugs via [GitHub Issues](https://github.com/felixgeelhaar/govee-light-management/issues)
- 💬 Join discussions in [GitHub Discussions](https://github.com/felixgeelhaar/govee-light-management/discussions)
- 📧 Contact: [felix@geelhaar.dev](mailto:felix@geelhaar.dev)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run the test suite: `npm test`
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

## Roadmap

### v2.8.0 (Current)

- [x] 18 actions — 13 keypad, 5 encoder
- [x] Five hybrid actions (Brightness, Color, Color Temperature, Saturation, Segment Color) that work on a key or a dial from one UUID
- [x] Recall — dynamic scenes, DIY scenes, and snapshots behind one picker
- [x] Schedule, Sequence, and Custom Effect actions
- [x] Group support across every action, with per-light fan-out and a `⚠ N/M` partial-failure banner
- [x] Per-device Kelvin ranges, with a group dial spanning the union of its members' ranges
- [x] Live state sync and the ●/◐/○ status badge on key artwork
- [x] Device Classifier and Capability Registry for device-specific error hints
- [x] Colour palettes (Warm/Cool/Pastel/Vivid) and recent-colour history

Full release history is in [CHANGELOG.md](CHANGELOG.md).

### v3.0.0 (Long-term Vision)

- [ ] LAN connectivity for lower latency
- [ ] WebSocket support for real-time state updates
- [ ] Cloud sync for group configurations across devices
- [ ] Integration with other smart home platforms
- [ ] Mobile companion app for remote control
- [ ] Multi-platform support (Windows/macOS/Linux)
- [ ] Web interface for advanced configuration
- [ ] Plugin SDK for third-party extensions

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Elgato Stream Deck SDK](https://docs.elgato.com/sdk) for the excellent development platform
- [Govee](https://govee.com/) for their smart lighting products and API
- [TypeScript](https://www.typescriptlang.org/) for type safety and developer experience
- The open source community for inspiration and best practices

## Support

If you find this plugin useful, consider:

- ⭐ Starring the repository
- 🐛 Reporting bugs and requesting features
- 🤝 Contributing code or documentation
- 💬 Sharing with the Stream Deck community

---

<div align="center">

**Made with ❤️ for the Stream Deck community**

[Website](https://geelhaar.dev) • [GitHub](https://github.com/felixgeelhaar) • [Twitter](https://twitter.com/felixgeelhaar)

</div>
