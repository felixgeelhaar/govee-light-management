# Govee Light Management for Stream Deck

<div align="center">

![Stream Deck Plugin](https://img.shields.io/badge/Stream%20Deck-Plugin-blue?style=flat-square&logo=elgato)
![Version](https://img.shields.io/badge/version-1.0.0-green?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue?style=flat-square&logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js)

**Enterprise-grade Stream Deck plugin for managing Govee smart lights with advanced group functionality**

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

### 🎯 **Stream Deck Plus Support** *(New!)*
- **Brightness Dial**: Smooth brightness control with physical dial
  - Rotate to adjust brightness (0-100%)
  - Press to toggle light on/off
  - Long touch to reset to 50%
- **Color Temperature Dial**: Intuitive temperature adjustment
  - Rotate to adjust from warm (2000K) to cool (9000K)
  - Press to cycle through presets
  - Visual gradient feedback on touchscreen
- **RGB Color Dial**: Full color control
  - Three modes: Hue, Saturation, Brightness
  - Press to switch modes
  - Long touch to reset to white
- **Group Master Dial**: Control multiple lights simultaneously
  - Adjust all lights in sync
  - Press to toggle entire group
  - Touch for quick preset access

### 🎨 **Professional UI**
- Custom Stream Deck dark theme with SDPI framework
- Responsive form controls and accessibility compliance
- Intuitive Property Inspector interface
- Real-time status updates and error handling
- Custom touchscreen layouts for Stream Deck Plus

### 🏗️ **Enterprise Architecture**
- Domain-driven design (DDD) with clean architecture
- Comprehensive TypeScript implementation
- Robust error handling and state management
- WebSocket communication for real-time updates

## Demo

> 📸 **Screenshots coming soon!** We're working on capturing the perfect screenshots to showcase the plugin in action.
> 
> For now, check out the [Usage](#usage) section below for detailed instructions on how to use each feature.

## Installation

### Prerequisites

- [Stream Deck Software](https://www.elgato.com/en/gaming/downloads) (v6.0 or later)
- [Node.js](https://nodejs.org/) (v18.0 or later)
- Govee API Key (obtainable from [Govee Developer API](https://developer.govee.com/))

### Option 1: Install from Stream Deck Store
*(Coming soon)*

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
   - Open the Govee Home app on your phone
   - Go to Settings → About Us → Apply for API Key
   - Follow the instructions to get your key
   - Save your API key securely

2. **Configure API Key** (One-time setup)
   - Add a "Toggle On/Off" action to any Stream Deck button
   - Click the button to open its property inspector
   - Enter your Govee API key in the **API Configuration** section at the top
   - The key is automatically saved and shared with all Govee actions

3. **Add Actions to Stream Deck**
   - Drag any Govee action to your Stream Deck buttons
   - No need to re-enter the API key - it's shared globally

### Individual Light Control

1. **Setup**
   - Add any Govee action to a Stream Deck button
   - Click "Discover Lights" to load your devices (uses global API key)
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
   - Click "Create New Group" (uses global API key)
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

### Stream Deck Plus Dial Controls

#### Brightness Dial
1. **Setup**
   - Add "Brightness Dial" action to an encoder slot
   - Configure min/max brightness and step size
   - Select target light

2. **Usage**
   - **Rotate**: Smoothly adjust brightness
   - **Press**: Toggle light on/off
   - **Long Touch**: Reset to 50% brightness
   - **Press + Rotate**: 2x speed adjustment

#### Color Temperature Dial
1. **Setup**
   - Add "Color Temperature Dial" action
   - Set temperature range (2000K-9000K)
   - Configure presets if desired

2. **Usage**
   - **Rotate**: Adjust color temperature
   - **Press**: Cycle through presets
   - **Touch**: Open preset menu
   - Visual gradient shows warm to cool

#### RGB Color Dial
1. **Setup**
   - Add "RGB Color Dial" action
   - Configure step size for precision
   - Use color picker for quick selection

2. **Usage**
   - **Rotate**: Adjust current mode (H/S/B)
   - **Press**: Switch between Hue/Saturation/Brightness
   - **Long Touch**: Reset to white
   - Touchscreen shows current color

#### Group Master Dial
1. **Setup**
   - Add "Group Master Dial" action
   - Select lights for the group
   - Configure sync delay for effects

2. **Usage**
   - **Rotate**: Adjust all lights simultaneously
   - **Press**: Toggle entire group
   - **Touch**: Access quick presets
   - **Long Touch**: Reset to defaults

### Advanced Features

#### Real-time State Monitoring
- Buttons automatically update to reflect current light states
- Group indicators show combined state of all lights
- Error states are clearly communicated
- Dial displays show live feedback

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

```bash
# Start development with auto-rebuild
npm run watch

# Run tests
npm test
npm run test:coverage

# Run linting
npm run lint
npm run lint:fix

# Type checking
npm run type-check

# Format code
npm run format
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

### v1.1.0 (Next Release)
- [ ] Scene management and automation
- [ ] Scheduled actions and timers
- [ ] Integration with Stream Deck Multi Actions
- [ ] Enhanced color picker with presets

### v1.2.0 (Future)
- [ ] Support for Govee DIY lights
- [ ] Music sync integration
- [ ] Custom effect creation
- [ ] Cloud sync for group configurations

### v2.0.0 (Long-term)
- [ ] Multi-platform support (Windows/macOS/Linux)
- [ ] Web interface for advanced configuration
- [ ] Plugin SDK for third-party extensions
- [ ] Integration with other smart home platforms

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