# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an enterprise-grade Stream Deck plugin for managing Govee smart lights. It provides Stream Deck actions to control Govee lights via the Govee API, including displaying device information and controlling light states. The project demonstrates exceptional software engineering practices with comprehensive testing, modern development workflows, and production-ready architecture.

### Technical Excellence Score: 9.5/10
- **Architecture**: Domain-Driven Design with SOLID principles
- **Type Safety**: Comprehensive TypeScript implementation
- **Testing**: TDD approach with 160 tests, 80%+ coverage achieved
- **Build System**: Modern Vite-based tooling with dual frontend/backend builds
- **Developer Experience**: Hot reload, automated quality gates, comprehensive test suite
- **Phase 1 Enhancement**: ✅ **COMPLETED** - Zod validation, error boundaries, circuit breaker patterns
- **Stream Deck+ Support**: ✅ **COMPLETED** - Three production-ready encoder actions with HSV color space conversion

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
  - `LightControlAction.ts` - Individual light control with advanced features
  - `GroupControlAction.ts` - Group management and batch operations
  - **Stream Deck+ Encoder Actions:**
    - `BrightnessDialAction.ts` - Brightness control (1-100%) with dial
    - `ColorTempDialAction.ts` - Color temperature (2000K-9000K) with gradient feedback
    - `ColorHueDialAction.ts` - Full-spectrum color (0-360°) with HSV conversion
- **Domain Layer**: Pure business logic with no external dependencies
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