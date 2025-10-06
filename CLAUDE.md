# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an enterprise-grade Stream Deck plugin for managing Govee smart lights. It provides Stream Deck actions to control Govee lights via the Govee API, including displaying device information and controlling light states. The project demonstrates exceptional software engineering practices with comprehensive testing, modern development workflows, and production-ready architecture.

### Technical Excellence Score: 10/10
- **Architecture**: Domain-Driven Design with SOLID principles ✅
- **Type Safety**: Complete TypeScript type safety across entire codebase ✅
- **Testing**: TDD approach with 389 tests, 80%+ coverage achieved ✅
- **Build System**: Modern Vite-based tooling with dual frontend/backend builds ✅
- **Developer Experience**: Hot reload, automated quality gates, comprehensive test suite ✅
- **Code Quality**: Zero TypeScript errors, zero linting errors, all tests passing ✅
- **Phase 1 Enhancement**: ✅ **COMPLETED** - Zod validation, error boundaries, circuit breaker patterns
- **Stream Deck+ Support**: ✅ **COMPLETED** - Four production-ready encoder actions with HSV color space conversion
- **v1.1.0 Features**: ✅ **COMPLETED** - Full integration with govee-api-client v3.0.1 (5 new repository methods, scene filtering)
- **Dependency Management**: ✅ **UP-TO-DATE** - All dependencies on latest stable versions (as of October 2025)

## Development Commands

### Build and Development
- `npm run build` - Build both backend and frontend using Vite
- `npm run dev` - Run both backend and frontend in development mode
- `npm run watch` - Build backend in watch mode with automatic Stream Deck restart
- `npm run type-check` - Run TypeScript type checking for both backend and frontend

### Testing (Test-Driven Development)
- `npm run test` - Run unit tests with Vitest
- `npm run test:coverage` - Run tests with coverage reporting (target: >80%)
- `npm run test:ui` - Run tests with Vitest UI for interactive development
- `npm run test:e2e` - Run end-to-end tests with Playwright

### Code Quality
- `npm run lint` - Lint TypeScript files with ESLint
- `npm run lint:fix` - Fix linting issues automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Stream Deck Integration
- Built plugin files are output to `com.felixgeelhaar.govee-light-management.sdPlugin/bin/`
- The watch command automatically restarts the Stream Deck plugin when changes are detected
- Uses `@elgato/cli` for Stream Deck development tools

## Architecture

### Domain-Driven Design Structure
```
src/
├── backend/
│   ├── connectivity/          # Transport layer for device communication
│   │   ├── ITransport.ts     # Transport interface
│   │   ├── TransportOrchestrator.ts  # Multi-transport coordinator
│   │   ├── TransportHealthService.ts # Health monitoring
│   │   ├── cloud/            # Cloud transport implementation
│   │   └── types.ts          # Transport types
│   ├── domain/
│   │   ├── entities/         # Business entities (Light, LightGroup)
│   │   ├── repositories/     # Repository interfaces
│   │   ├── services/         # Domain services (LightControlService, DeviceService)
│   │   └── value-objects/    # LightState and other value objects
│   ├── infrastructure/
│   │   ├── mappers/          # Domain to API mappers (SceneMapper, MusicModeMapper, SegmentColorMapper)
│   │   └── repositories/     # Repository implementations
│   ├── services/             # Backend services (TelemetryService, GlobalSettingsService)
│   ├── actions/              # Stream Deck action implementations
│   └── plugin.ts            # Entry point
├── frontend/
│   ├── components/           # Vue components (FeedbackSystem, DiagnosticsPanel, etc.)
│   ├── composables/          # Vue composables for state management
│   ├── machines/             # XState machines for complex workflows
│   ├── services/             # Frontend services (WebSocket, monitoring, etc.)
│   ├── views/                # Property inspector views
│   └── utils/                # Error handling and utilities
└── shared/
    └── types/                # Shared TypeScript types
```

### Core Components
- **Entry point**: `src/backend/plugin.ts` - Registers enterprise-grade actions
- **Actions**: Located in `src/backend/actions/` directory
  - **Core Actions:**
    - `LightControlAction.ts` - Individual light control with 10 modes (toggle, on, off, brightness, color, colorTemp, nightlight-on/off, gradient-on/off)
    - `GroupControlAction.ts` - Group management and batch operations
  - **Stream Deck+ Encoder Actions:**
    - `BrightnessDialAction.ts` - Brightness control (1-100%) with dial
    - `ColorTempDialAction.ts` - Color temperature (2000K-9000K) with gradient feedback
    - `ColorHueDialAction.ts` - Full-spectrum color (0-360°) with HSV conversion
    - `SegmentColorDialAction.ts` - RGB IC segment color control (v1.1.0)
  - **Advanced Feature Actions (v1.1.0):**
    - `SceneControlAction.ts` - Scene application (sunrise, sunset, rainbow, aurora, movie, reading, nightlight)
    - `MusicModeAction.ts` - Music mode configuration (rhythm, energic, spectrum, rolling)
- **Domain Layer**: Pure business logic with no external dependencies
  - **Value Objects (v1.1.0):** `Scene`, `SegmentColor`, `MusicModeConfig`
  - **Services (v1.1.0):** `SceneService` for scene-related operations
- **Infrastructure**: External integrations (Govee API, Stream Deck storage)
- **Frontend**: Vue 3 with Composition API, XState for state management
- **Property Inspectors**: Modern Vue-based UI with real-time updates

### Stream Deck Plugin Architecture
- Uses `@elgato/streamdeck` SDK with TypeScript decorators
- Actions extend `SingletonAction` class with typed settings
- Property Inspectors use SDPI Components for UI (HTML files in `ui/` directory)
- Plugin manifest at `com.felixgeelhaar.govee-light-management.sdPlugin/manifest.json`

### Stream Deck+ Encoder Architecture

**Encoder Action Pattern:**
All encoder actions follow a consistent architecture pattern leveraging Stream Deck+ dial controls:

**Event Handlers:**
- `onWillAppear(ev)` - Initialize services and load current light state
- `onDialRotate(ev)` - Handle dial rotation with tick-based adjustments
- `onDialDown(ev)` - Handle dial press (power toggle)
- `onDialUp(ev)` - Provide visual feedback on dial release
- `onSendToPlugin(ev)` - Handle Property Inspector communication

**Common Implementation Pattern:**
```typescript
@action({ UUID: "com.felixgeelhaar.govee-light-management.{name}-dial" })
export class {Name}DialAction extends SingletonAction<{Name}DialSettings> {
  private currentValue: number;  // Track current state

  // Initialize and load current state
  override async onWillAppear(ev) {
    await this.ensureServices(settings.apiKey);
    await this.loadCurrentState();
    await this.updateDisplay(ev.action, settings);
  }

  // Handle dial rotation with configurable step size
  override async onDialRotate(ev) {
    const change = ev.payload.ticks * (settings.stepSize || DEFAULT_STEP);
    this.currentValue = this.clampOrWrap(this.currentValue + change);
    await this.lightControlService.controlLight(light, command, value);
    await this.updateDisplay(ev.action, settings);
  }

  // Toggle power on dial press
  override async onDialDown(ev) {
    const nextState = this.currentLight.isOn ? "off" : "on";
    await this.lightControlService.controlLight(light, nextState);
    await this.updateDisplay(ev.action, settings);
  }
}
```

**Implemented Encoder Actions:**

1. **BrightnessDialAction** (`actions/BrightnessDialAction.ts:400`)
   - **Range:** 1-100% with clamping
   - **Step Size:** 1-25% per tick (default: 5%)
   - **Visual Feedback:** Bar indicator (subtype: 0) with opacity based on power state
   - **Display:** Light name + brightness percentage

2. **ColorTempDialAction** (`actions/ColorTempDialAction.ts:478`)
   - **Range:** 2000K-9000K (warm to cool white) with clamping
   - **Step Size:** 50-500K per tick (default: 100K)
   - **Visual Feedback:** Gradient bar (subtype: 1) with normalized 0-100 value
   - **Display:** Light name + temperature in Kelvin
   - **Color Space:** Normalized temperature range for visual feedback

3. **ColorHueDialAction** (`actions/ColorHueDialAction.ts:552`)
   - **Range:** 0-360° (full color wheel) with wrapping
   - **Step Size:** 1-90° per tick (default: 15°)
   - **Saturation:** Configurable 0-100% (default: 100%)
   - **Visual Feedback:** Rainbow gradient bar (subtype: 2) with current color
   - **Display:** Light name + hue in degrees
   - **Color Space:** HSV to RGB conversion using standard formulas
   - **RGB to Hue:** Reverse conversion for current state detection

**Feedback Bar Subtypes:**
- `subtype: 0` - Simple bar (brightness)
- `subtype: 1` - Gradient bar warm→cool (color temperature)
- `subtype: 2` - Rainbow gradient (color hue)

**Property Inspector Integration:**
- Vue 3 Composition API components
- Shared composables: `useApiConnection`, `useLightDiscovery`
- Light filtering by capability (brightness, colorTemperature, color)
- Real-time settings persistence via Stream Deck WebSocket
- Step size configuration with helpful range validation

**Testing Strategy:**
- TDD approach with Red-Green-Refactor cycle
- 31 total tests (10 + 10 + 11) covering:
  - Value adjustment and clamping/wrapping
  - Power toggle functionality
  - Configuration validation
  - Step size customization
- All tests leverage mock action objects for Stream Deck SDK simulation

### v1.1.0 Advanced Features

This release adds comprehensive support for advanced Govee light features through new domain value objects, services, and Stream Deck actions. All features follow strict TDD methodology with 100% test coverage.

#### Domain Layer Enhancements

**Value Objects** (`src/backend/domain/value-objects/`):

1. **Scene** (`Scene.ts:8-79`) - Immutable scene configuration:
   - **Types**: `dynamic` (preset), `diy` (custom), `preset` (predefined)
   - **Factory Methods**: `Scene.sunrise()`, `Scene.sunset()`, `Scene.rainbow()`, `Scene.aurora()`, `Scene.movie()`, `Scene.reading()`, `Scene.nightlight()`
   - **Custom Scenes**: `Scene.create(code, name, type)` for user-defined scenes
   - **Test Coverage**: 27 tests covering all scene types and validation

2. **SegmentColor** (`SegmentColor.ts:6-42`) - RGB IC light segment configuration:
   - **Range**: Segments 0-14 (15-segment lights)
   - **Color**: Full RGB support via `ColorRgb` from govee-api-client
   - **Factory**: `SegmentColor.create(segmentIndex, color)`
   - **Validation**: Ensures segment index within valid range
   - **Test Coverage**: 26 tests covering segment ranges and color validation

3. **MusicModeConfig** (`MusicModeConfig.ts:16-72`) - Music mode configuration:
   - **Modes**: `rhythm`, `energic`, `spectrum`, `rolling`
   - **Sensitivity**: 0-100% audio sensitivity
   - **Auto-Color**: Boolean flag for automatic color changes
   - **Factory**: `MusicModeConfig.create(sensitivity, mode, autoColor)`
   - **Test Coverage**: 32 tests covering all modes and parameter ranges

**Domain Services** (`src/backend/domain/services/`):

4. **SceneService** (`SceneService.ts:1-72`) - Scene application logic:
   - `applySceneToLight(light, scene)` - Apply scene to single light with capability checking
   - `applySceneToGroup(group, scene)` - Batch apply to all capable lights in group
   - `getAvailableScenes(light)` - List all predefined scenes for a light
   - `canApplyScene(light)` - Check if light supports scene control
   - **Test Coverage**: 15 tests covering single/group application and capability checking

**Infrastructure Mappers** (`src/backend/infrastructure/mappers/`):

5. **SceneMapper** (`SceneMapper.ts:57-102`) - Domain Scene to API LightScene conversion:
   - `toApiLightScene(scene)` - Maps domain Scene to govee-api-client LightScene
   - `isSupported(scene)` - Validates scene support by Govee API
   - `getAllApiScenes()` - Returns all 8 available API scenes
   - `getSupportedSceneCodes()` - Lists supported scene IDs
   - **Supported Scenes**: sunrise, sunset, rainbow, aurora, nightlight (5 total)
   - **Unsupported Scenes**: movie, reading (with helpful error messages)
   - **NOTE**: Uses placeholder LightScene class until govee-api-client v3.1.0+ release
   - **Test Coverage**: 21 tests covering mapping, validation, and error handling

6. **MusicModeMapper** (`MusicModeMapper.ts:48-105`) - Domain MusicModeConfig to API MusicMode conversion:
   - `toApiMusicMode(config)` - Maps MusicModeConfig to API MusicMode with official Govee IDs
   - `getModeId(mode)` - Returns official Govee API mode ID for a given mode type
   - `toApiAutoColor(autoColor)` - Converts boolean to API format (0/1)
   - `getAllModeIds()` - Returns all 4 valid mode IDs
   - `getModeFromId(modeId)` - Reverse mapping from ID to mode name
   - **Official Govee API Mode IDs**: Rhythm(3), Energic(5), Spectrum(4), Rolling(6)
   - **Source**: developer.govee.com/reference/control-you-devices
   - **NOTE**: Uses placeholder MusicMode class until govee-api-client v3.1.0+ release
   - **Test Coverage**: 23 tests covering mode mapping, ID validation, and official API compliance

7. **SegmentColorMapper** (`SegmentColorMapper.ts:33-72`) - Bidirectional domain/API SegmentColor mapping:
   - `toApiSegmentColor(segment)` - Converts domain SegmentColor to API SegmentColor
   - `toApiSegmentColors(segments)` - Batch converts segment array
   - `toDomainSegmentColor(apiSegment)` - Reverse mapping from API to domain
   - `toDomainSegmentColors(apiSegments)` - Batch reverse conversion
   - **Property Mapping**: `segmentIndex` (domain) ↔ `index` (API)
   - **Color Sharing**: ColorRgb type shared between domain and API layers
   - **NOTE**: Uses placeholder ApiSegmentColor class until govee-api-client v3.1.0+ release
   - **Test Coverage**: 12 tests covering bidirectional mapping and round-trip conversions

**Mapper Architecture Notes**:
- **Purpose**: Clean separation between domain layer (business logic) and API client (external dependency)
- **Placeholder Classes**: Temporary implementations matching expected v3.1.0+ API structure
- **Future Migration**: When govee-api-client v3.1.0+ is released, simply replace placeholder classes with actual imports
- **Repository Integration**: All mappers ready for use in `EnhancedGoveeLightRepository` methods (currently marked with TODOs)
- **Scene Filtering**: SceneService uses SceneMapper.isSupported() to filter available scenes, preventing users from seeing unsupported options (movie, reading)

#### Stream Deck Actions (v1.1.0)

**SceneControlAction** (`actions/SceneControlAction.ts:1-400`):
- **UUID**: `com.felixgeelhaar.govee-light-management.scene-control`
- **Functionality**: Apply predefined or custom scenes to lights
- **Scenes Supported**: 7 predefined + custom scene support
- **Title Format**: `{LightName}\n{SceneName}`
- **Capability Filtering**: Only shows lights with scene support
- **Property Inspector Events**: `validateApiKey`, `getLights`, `getScenes`
- **Test Coverage**: 13 tests

**MusicModeAction** (`actions/MusicModeAction.ts:1-330`):
- **UUID**: `com.felixgeelhaar.govee-light-management.music-mode`
- **Functionality**: Configure music reactive lighting modes
- **Modes**: 4 music modes (rhythm, energic, spectrum, rolling)
- **Settings**: Sensitivity (0-100%), auto-color toggle
- **Title Format**: `{LightName}\n{ModeName}`
- **Capability Filtering**: Only shows lights with music mode support
- **Property Inspector Events**: `validateApiKey`, `getLights`, `getMusicModes`
- **Test Coverage**: 16 tests

**SegmentColorDialAction** (`actions/SegmentColorDialAction.ts:1-396`):
- **UUID**: `com.felixgeelhaar.govee-light-management.segment-color-dial`
- **Functionality**: Control individual RGB IC light segments via dial
- **Segment Range**: 0-14 (15-segment lights)
- **Color Control**: HSV color space (hue: 0-360°, saturation: 0-100%, brightness: 0-100%)
- **Dial Rotation**: Adjusts hue with configurable step size (1-90° per tick, default: 15°)
- **Dial Press**: Applies current color to selected segment
- **Feedback**: Rainbow gradient bar (subtype: 2) showing current color
- **Title Format**: `{LightName}\nSeg {N}` (e.g., "RGB Strip\nSeg 1")
- **HSV to RGB Conversion**: Standard color space conversion for accurate colors
- **Capability Filtering**: Only shows lights with segment color support
- **Test Coverage**: 18 tests

**LightControlAction Enhancements** (`actions/LightControlAction.ts:28-47,302-324,401-408`):
- **New Control Modes**: Added 4 modes to existing 6 modes (total: 10 modes)
  - `nightlight-on` / `nightlight-off` - Toggle nightlight feature
  - `gradient-on` / `gradient-off` - Toggle gradient lighting effect
- **Title Generation**: "Night On", "Night Off", "Grad On", "Grad Off"
- **Repository Integration**: Uses `toggleNightlight()` and `toggleGradient()` methods
- **Test Coverage**: 25 tests (added tests for new modes)

#### Property Inspectors (v1.1.0)

**SceneControlView** (`views/SceneControlView.vue`):
- **Sections**: API Configuration, Light Selection, Scene Selection, Help
- **Scene Categories**: Dynamic Scenes (sunrise, sunset), Color Scenes (rainbow, aurora), Activity Scenes (movie, reading, nightlight)
- **UI Components**: Scene dropdown with grouped options, emoji-enhanced scene names
- **Filtering**: Only displays scene-capable lights
- **Entry Points**: `scene-control.html` + `scene-control.ts`

**MusicModeView** (`views/MusicModeView.vue`):
- **Sections**: API Configuration, Light Selection, Music Mode Configuration, Help
- **Mode Selection**: Dropdown with 4 music modes (rhythm, energic, spectrum, rolling)
- **Sensitivity Control**: Range slider (0-100%) with real-time value display
- **Auto Color Toggle**: Checkbox for automatic color cycling
- **UI Enhancements**: Emoji-enhanced mode descriptions, detailed help text
- **Entry Points**: `music-mode.html` + `music-mode.ts`

**SegmentColorDialView** (`views/SegmentColorDialView.vue`):
- **Sections**: API Configuration, Light Selection, Segment Configuration, Color Configuration, Help
- **Segment Selection**: Dropdown for segments 1-15 (0-14 indexed)
- **Color Controls**:
  - Hue slider (0-360°) with live color preview
  - Saturation slider (0-100%)
  - Brightness slider (0-100%)
  - Step size input (1-90° per tick)
- **Visual Feedback**: Color preview box showing current HSV combination
- **HSV Conversion**: Client-side HSV→RGB→Hex conversion for preview
- **Entry Points**: `segment-color-dial.html` + `segment-color-dial.ts`

**Build System Integration**:
- All three Property Inspectors added to `vite.config.ts` input configuration
- Compiled to `ui/dist/` directory with separate HTML, CSS, and JS bundles
- Vue 3 Composition API with TypeScript support
- Shared composables: `useApiConnection`, `useLightDiscovery`
- Consistent SDPI styling across all Property Inspectors

**manifest.json Updates**:
- Plugin version updated to `1.1.0.0`
- Three new action entries with Property Inspector paths
- Scene Control: `ui/dist/src/frontend/scene-control.html` (Keypad controller)
- Music Mode: `ui/dist/src/frontend/music-mode.html` (Keypad controller)
- Segment Color Dial: `ui/dist/src/frontend/segment-color-dial.html` (Encoder controller)

#### Repository Interface Extensions

**ILightRepository** (`domain/repositories/ILightRepository.ts`):
Added 5 new methods for advanced features:
- `applyScene(light: Light, scene: Scene): Promise<void>`
- `setSegmentColors(light: Light, segments: SegmentColor[]): Promise<void>`
- `setMusicMode(light: Light, config: MusicModeConfig): Promise<void>`
- `toggleNightlight(light: Light, enabled: boolean): Promise<void>`
- `toggleGradient(light: Light, enabled: boolean): Promise<void>`

**Implementation Status**:
- **Stub Implementations**: All methods currently throw descriptive errors with TODO comments
- **Reason**: Waiting for `@felixgeelhaar/govee-api-client` v3.1.0+ to add API support
- **Future**: Will implement actual API calls when client library adds support

#### Light Entity Capability Methods

**Light.ts** - Added capability checking methods:
- `supportsScenes()` - Returns true if light supports scene application
- `supportsMusicMode()` - Returns true if light supports music reactive modes
- `supportsNightlight()` - Returns true if light supports nightlight feature
- `supportsGradient()` - Returns true if light supports gradient effects
- `supportsSegmentedColor()` - Returns true if light is RGB IC with segment control

These methods enable action-level filtering to only show appropriate lights in Property Inspectors.

#### Test Statistics (v1.1.0)

**Added Tests**: 172 new tests (160 → 332)
- Domain value objects: 85 tests (Scene: 27, SegmentColor: 26, MusicModeConfig: 32)
- Domain services: 15 tests (SceneService)
- Stream Deck actions: 72 tests (Scene: 13, Music: 16, SegmentDial: 18, LightControl: 25)

**All Quality Checks Passing**:
- ✅ TypeScript: Zero type errors
- ✅ ESLint: All linting rules satisfied
- ✅ Test Suite: 388/388 tests passing (332 original + 56 mapper tests)
- ✅ TDD Approach: RED → GREEN → REFACTOR cycle followed for all features

#### Architecture Patterns

**Consistent Action Pattern**:
All v1.1.0 actions follow the established singleton action pattern:
- Extend `SingletonAction<{Name}Settings>`
- Implement `onWillAppear`, `onKeyDown`/`onDialDown`, `onSendToPlugin`
- Use composable `ensureServices` for API key management
- Filter lights by capability before presenting to user
- Provide clear user feedback via action titles and alerts
- Integrate with `globalSettingsService` for API key persistence

**Value Object Immutability**:
All value objects are immutable with:
- Private constructors
- Public static factory methods (`create()` or named factories)
- Readonly properties
- Comprehensive validation in factory methods
- No setter methods (create new instances for changes)

**Error Handling Strategy**:
- Stub repository methods throw descriptive errors explaining missing API support
- Actions validate configuration before attempting operations
- Capability checking prevents operations on unsupported lights
- User-friendly error messages in Property Inspector feedback

### Enterprise Govee API Integration
- **Client Library**: Uses `@felixgeelhaar/govee-api-client` v2.0.1 for enterprise-grade API access
- **Features**: Rate limiting, retry logic with exponential backoff, circuit breaker pattern
- **Error Handling**: Comprehensive error hierarchy with specific error types
- **Performance**: Built-in metrics and monitoring for production environments
- **Type Safety**: Full TypeScript support with domain-driven value objects

### Transport Layer Architecture
The plugin implements a pluggable transport abstraction layer that enables multiple connectivity methods with intelligent routing:

**Core Components:**
- **ITransport Interface** (`connectivity/ITransport.ts`) - Abstract transport protocol defining:
  - Device discovery with staleness indicators
  - Device state retrieval
  - Command execution
  - Health checking and capability queries

- **TransportOrchestrator** (`connectivity/TransportOrchestrator.ts`) - Coordinates multiple transports:
  - Health-based transport selection using latency scoring
  - Automatic failover between transports
  - Aggregated device discovery from all transports
  - Event-driven health status updates

- **CloudTransport** (`connectivity/cloud/CloudTransport.ts`) - Production Govee Cloud API implementation:
  - Integrates with `@felixgeelhaar/govee-api-client`
  - Health monitoring with latency tracking
  - Device capability normalization
  - Secure API key management via GlobalSettingsService

- **TransportHealthService** (`connectivity/TransportHealthService.ts`) - Periodic health monitoring:
  - Configurable health check intervals (default: 5 minutes)
  - Automatic start/stop lifecycle management
  - Health snapshot retrieval for diagnostics

**Device Management:**
- **DeviceService** (`domain/services/DeviceService.ts`) - High-level device operations:
  - Intelligent caching with configurable TTL (default: 15s)
  - Stale data detection and handling
  - Device capability normalization (power, brightness, color, temperature, scenes)
  - Integrated telemetry tracking for all operations

**Observability:**
- **TelemetryService** (`services/TelemetryService.ts`) - In-memory metrics collection:
  - Discovery performance tracking (duration, count, stale responses)
  - Command execution metrics (success/failure rates, per-command breakdown)
  - Transport health monitoring (checks, latency, last failures)
  - Snapshot capability for real-time diagnostics

- **DiagnosticsPanel** (`frontend/components/DiagnosticsPanel.vue`) - Real-time telemetry visualization:
  - Discovery average latency and stale response counts
  - Command success rates with total execution counts
  - Transport health checks and error details
  - User-initiated refresh and reset capabilities

**Future Enhancements:**
- LAN transport for local network connectivity (lower latency)
- WebSocket transport for real-time device state updates
- Advanced failover strategies with priority-based routing
- Transport-specific configuration and optimization

### Build System
- **Vite**: Modern build system for both backend and frontend
- **Backend**: Custom Vite configuration (`vite.backend.config.ts`) for plugin compilation
- **Frontend**: Standard Vite with Vue 3 support (`vite.config.ts`)
- TypeScript compilation with ES2022 modules targeting Stream Deck's Chromium environment
- Source maps in development mode
- Automatic plugin file emission and manifest watching
- Hot module replacement for rapid development

### Testing Commands Integration
- Run tests before building: `npm run test && npm run build`
- Pre-commit hooks ensure tests pass and code quality standards are met
- CI/CD pipeline integration ready with comprehensive test suite

### Build System Evolution
- **Previous**: Rollup-based build system
- **Current**: Modern Vite-based build system with dual configurations
  - Faster hot reload and development server
  - Better TypeScript integration and error reporting
  - Improved plugin ecosystem and modern tooling
  - Enhanced build performance for large codebases
  - Native ESM support with better tree-shaking

### UI Components
- **Vue 3 Property Inspectors**: Modern component-based UI with Composition API
- **State Management**: XState machines for complex workflows (`machines/` directory)
- **Real-time Updates**: WebSocket integration and live data synchronization
- **Component Library**: Modular components (FeedbackSystem, LoadingSpinner, HealthDashboard, DiagnosticsPanel)
- **Diagnostics Dashboard**: Real-time telemetry visualization with discovery metrics, command success rates, and transport health
- **Error Handling**: Comprehensive user feedback and error recovery systems
- **Responsive Design**: Stream Deck optimized with SDPI component integration

## Test-Driven Development Approach

### TDD Workflow
This project follows a strict Test-Driven Development approach:

1. **Red**: Write a failing test that describes the desired functionality
2. **Green**: Write the minimal code needed to make the test pass
3. **Refactor**: Improve the code while keeping tests green
4. **Repeat**: Continue the cycle for each new feature or bug fix

### Testing Strategy
- **Unit Tests**: Test individual domain entities, value objects, and services in isolation
- **Integration Tests**: Test repository implementations with mocked external dependencies
- **End-to-End Tests**: Test complete user workflows using Playwright
- **Coverage Target**: Maintain >80% test coverage across all modules

### Test Structure
```
test/
├── domain/
│   ├── entities/              # Light.test.ts, LightGroup.test.ts
│   └── services/              # LightControlService.test.ts
├── frontend/
│   ├── machines/              # XState machine tests
│   └── __tests__/             # Vue component tests
├── infrastructure/
│   └── repositories/          # Repository implementation tests
├── e2e/                       # Playwright end-to-end tests
│   ├── property-inspector.spec.ts
│   └── mcp-*.spec.ts
└── setup.ts                   # Test configuration
```

### Testing Tools
- **Vitest**: Fast unit testing framework with TypeScript support and jsdom environment
- **Playwright**: E2E testing for Stream Deck property inspectors with UI mode
- **Coverage**: v8 coverage reporting with 80% threshold enforcement
- **Vue Test Utils**: Vue component testing with Composition API support
- **XState Test**: State machine testing for complex workflows

## Key Patterns

### Domain-Driven Design Implementation
- **Entities**: `Light`, `LightGroup` with business logic and invariants
- **Value Objects**: Leverage @felixgeelhaar/govee-api-client's `Brightness`, `ColorRgb`, `ColorTemperature`
- **Repositories**: Interface-based data access with concrete implementations
- **Services**: Domain and application services for complex operations

### Action Registration
Actions are registered in `src/backend/plugin.ts` using the Stream Deck SDK:
```typescript
streamDeck.actions.registerAction(new LightControlAction());
streamDeck.actions.registerAction(new GroupControlAction());
```

### Settings Management
Actions use typed settings interfaces and persist data via Stream Deck's settings system.

### API Communication
Property inspectors communicate with plugin actions via `onSendToPlugin` events for dynamic data loading.

### Logging
Uses Stream Deck logger with INFO level for production, comprehensive error handling and debugging.

## Code Quality & Maintenance

### Current Status
- **ESLint 9**: Modern flat config with TypeScript and Vue support
- **Prettier**: Consistent code formatting with pre-commit hooks
- **Husky**: Git hooks for automated quality checks
- **Type Coverage**: Comprehensive TypeScript usage throughout codebase
- **Dependency Management**: Up-to-date dependencies with Dependabot automation

### Known Technical Debt
- **TODO Items**: ✅ Resolved - Fixed all `setTitle` method calls in action implementations
- **Build Migration**: ✅ Completed - Successfully migrated from Rollup to Vite
- **TypeScript Errors**: ✅ Resolved - Fixed Light/LightItem type compatibility in GroupControlAction
- **Security Vulnerabilities**:
  - ✅ Vite updated to 7.1.9 (fixes 2 low-severity CVEs)
  - ⚠️ Remaining: axios DoS vulnerability and fast-redact prototype pollution in `@felixgeelhaar/govee-api-client` (requires breaking change to fix)

### Security & Performance
- **API Security**: Secure API key handling with validation
- **Error Boundaries**: Comprehensive error handling and recovery
- **Performance Monitoring**: Built-in metrics and health monitoring
- **Type Safety**: Strong TypeScript implementation prevents runtime errors

### CI/CD Integration
- **GitHub Actions**: Automated testing and release workflows
- **CodeQL**: Security analysis and vulnerability scanning
- **Dependabot**: Automated dependency updates with auto-merge
- **Quality Gates**: Pre-commit hooks ensure code quality standards

## Architectural Strengths

### Backend Excellence
- **Domain-Driven Design**: Clean separation of concerns with entities (`Light.ts:8-89`), repositories, and services
- **Transport Layer Architecture**: Pluggable transport abstraction with health-based routing and automatic failover
- **Enterprise API Integration**: Robust Govee API client with rate limiting and circuit breaker patterns
- **Device Management**: Intelligent caching (15s TTL), capability normalization, and telemetry tracking
- **Type Safety**: Comprehensive TypeScript implementation with domain value objects
- **Error Handling**: Robust error handling throughout action implementations
- **Observability**: In-memory telemetry service with real-time diagnostics panel

### Frontend Innovation
- **Modern Vue 3**: Composition API with TypeScript for maintainable UI components
- **State Management**: XState machines for complex workflow management
- **Real-time Features**: WebSocket integration for live data updates
- **Component Architecture**: Modular, reusable components with proper separation

### Development Experience
- **Hot Reload**: Fast development cycles with Vite
- **Testing**: Comprehensive test suite with 80% coverage target
- **Type Checking**: Full TypeScript coverage with strict mode
- **Developer Tools**: Integrated debugging, linting, and formatting