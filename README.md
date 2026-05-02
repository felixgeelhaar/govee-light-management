# Govee Light Management for Stream Deck

<div align="center">

![Stream Deck Plugin](https://img.shields.io/badge/Stream%20Deck-Plugin-blue?style=flat-square&logo=elgato)
![Version](https://img.shields.io/badge/version-2.2.0-green?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue?style=flat-square&logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-20+-green?style=flat-square&logo=node.js)

**Control your room's Govee lighting without ever leaving what you're working on.**

One press for a saved look. One rotation for the perfect brightness. Status visible at a glance. The phone stays in your pocket.

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Contributing](#contributing) • [License](#license)

</div>

## Features

### 🎛️ **Individual Light Control**

- Toggle lights on/off with visual state indicators
- Adjust brightness, color, and color temperature
- Real-time state synchronization with your lights
- Support for all Govee light models

### 👥 **Advanced Group Management**

- **Create** custom light groups with intuitive interface
- **Edit** group names and modify included lights
- **Delete** groups with confirmation prompts
- **Visual indicators** for group states (●/○/◐)

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

### Option 1: Install from Stream Deck Store

_(Coming soon)_

### Option 2: Manual Installation

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

3. **Install the plugin**

   ```bash
   # Install using Stream Deck CLI
   streamdeck install com.felixgeelhaar.govee-light-management.sdPlugin
   ```

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

2. **Add Actions to Stream Deck**
   - Drag "Govee Light Control" or "Govee Group Control" to a button
   - Configure with your API key in the Property Inspector

### Individual Light Control

1. **Setup**
   - Add "Govee Light Control" action to a Stream Deck button
   - Enter your Govee API key
   - Select a light from the dropdown

2. **Configuration Options**
   - **Control Mode**: Toggle, On, Off, Brightness, Color, Color Temperature
   - **Brightness**: Set specific brightness level (1-100%)
   - **Color**: Choose RGB color with hex picker
   - **Color Temperature**: Set warmth (2000K-9000K)

3. **Usage**
   - Press button to execute the configured action
   - Button shows real-time state: ● (on), ○ (off), ◐ (mixed)

### Group Management

1. **Create Groups**
   - Add "Govee Group Control" action
   - Enter API key and click "Create New Group"
   - Name your group and select lights to include
   - Click "Create Group" to save

2. **Edit Groups**
   - Select existing group from dropdown
   - Click "✏️ Edit" button
   - Modify name or change included lights
   - Click "Update Group" to save changes

3. **Delete Groups**
   - Select group from dropdown
   - Click "🗑️ Delete" button
   - Confirm deletion in popup dialog

4. **Control Groups**
   - Configure control mode (same options as individual lights)
   - Press button to control all lights in group simultaneously
   - Visual feedback shows combined group state

### Stream Deck+ Encoder Controls

**Note:** Requires Stream Deck+ device with dial/encoder support.

#### Brightness Dial

1. **Setup**
   - Add "Brightness Dial" action to an encoder slot
   - Enter API key and discover lights
   - Select a light with brightness capability
   - Configure step size (1-25% per tick, default: 5%)

2. **Usage**
   - **Rotate clockwise**: Increase brightness
   - **Rotate counter-clockwise**: Decrease brightness
   - **Press dial**: Toggle light power on/off
   - **Display**: Shows light name and current brightness percentage
   - **Feedback bar**: Visual brightness indicator (dimmed when off)

#### Color Temperature Dial

1. **Setup**
   - Add "Color Temperature Dial" action to an encoder slot
   - Enter API key and discover lights
   - Select a light with color temperature capability
   - Configure step size (50-500K per tick, default: 100K)

2. **Usage**
   - **Rotate clockwise**: Cooler white (towards 9000K)
   - **Rotate counter-clockwise**: Warmer white (towards 2000K)
   - **Press dial**: Toggle light power on/off
   - **Display**: Shows light name and current temperature in Kelvin
   - **Feedback bar**: Gradient indicator (warm to cool)

#### Color Hue Dial

1. **Setup**
   - Add "Color Hue Dial" action to an encoder slot
   - Enter API key and discover lights
   - Select a light with color control capability
   - Configure step size (1-90° per tick, default: 15°)
   - Configure saturation (0-100%, default: 100%)

2. **Usage**
   - **Rotate clockwise**: Cycle through color spectrum
   - **Rotate counter-clockwise**: Cycle backward through spectrum
   - **Press dial**: Toggle light power on/off
   - **Display**: Shows light name and current hue in degrees
   - **Feedback bar**: Rainbow gradient indicator
   - **Color wheel**: 0° Red → 120° Green → 240° Blue → 360° Red

### Advanced Features

#### Real-time State Monitoring

- Buttons automatically update to reflect current light states
- Group indicators show combined state of all lights
- Error states are clearly communicated

#### API Key Management

- API keys are securely stored in Stream Deck settings
- Validation occurs before attempting API calls
- Clear error messages for authentication issues

#### Testing Groups

- Use "Test Group" button to verify group functionality
- Performs quick blink test on all group lights
- Confirms connectivity and group integrity

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
├── src/                          # Source code
│   ├── actions/                  # Stream Deck action handlers
│   ├── domain/                   # Domain layer (DDD)
│   │   ├── entities/            # Business entities
│   │   ├── repositories/        # Repository interfaces
│   │   └── services/            # Domain services
│   └── infrastructure/          # Infrastructure layer
│       └── repositories/        # Repository implementations
├── com.felixgeelhaar.govee-light-management.sdPlugin/
│   ├── ui/                      # Property Inspector UI
│   └── bin/                     # Built plugin files
├── test/                        # Test files
└── docs/                        # Documentation
```

### Architecture

This plugin follows **Domain-Driven Design (DDD)** principles:

- **Domain Layer**: Core business logic and entities
- **Infrastructure Layer**: External API integrations and data persistence
- **Application Layer**: Stream Deck action handlers and UI coordination

### Testing

```bash
# Unit tests
npm test

# Coverage report
npm run test:coverage

# E2E tests (requires Stream Deck)
npm run test:e2e

# Start test server for manual testing
npm run test:server
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
- Set color temperature (2000K-9000K)

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

### v2.2.0 (Current - Released)

- [x] Enhanced color picker with preset palettes (Warm/Cool/Pastel/Vivid) and recent colors history
- [x] Schedule action — time-based automation with Daily/Weekly/Delay triggers
- [x] Sequence action — chain multi-step light commands with configurable delays
- [x] Custom Effect action — 4 RGB animations (Rainbow Wave, Pulse, Fade, Strobe) on IC strips
- [x] Device Classifier — automatic Bulb/LED Strip/Light Bar/Floor Lamp detection
- [x] Capability Registry — helpful error messages with device-class-specific hints
- [x] Expanded device cache TTL (15s → 30s) for reduced API calls
- [x] 17 total actions (12 keypad + 5 dial)

### v2.1.4 (Released)

- [x] Individual light control with 8 modes
- [x] Advanced group management with full dial support
- [x] Stream Deck+ encoder support (5 dials)
- [x] Real-time state synchronization with live state sync on appear
- [x] Scene, Music, Feature Toggle actions
- [x] Full group support across all actions and dials
- [x] Visual feedback system with green/red flash indicators
- [x] Saturation dial, overlay mode clearing, dial state sync fixes

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
