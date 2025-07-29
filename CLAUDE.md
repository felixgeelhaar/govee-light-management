# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Stream Deck plugin for managing Govee smart lights. It provides Stream Deck actions to control Govee lights via the Govee API, including displaying device information and controlling light states.

## Development Commands

### Build and Development
- `npm run build` - Build the plugin using Rollup
- `npm run watch` - Build in watch mode with automatic Stream Deck restart on changes
- `npm run type-check` - Run TypeScript type checking without emitting files

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
├── domain/
│   ├── entities/          # Business entities (Light, LightGroup)
│   ├── repositories/      # Repository interfaces
│   └── services/          # Domain services
├── infrastructure/
│   └── repositories/      # Repository implementations
├── actions/               # Stream Deck action implementations
└── plugin.ts             # Entry point
```

### Core Components
- **Entry point**: `src/plugin.ts` - Registers enterprise-grade actions
- **Actions**: Located in `src/actions/` directory
  - `LightControlAction.ts` - Individual light control with advanced features
  - `GroupControlAction.ts` - Group management and batch operations
- **Domain Layer**: Pure business logic with no external dependencies
- **Infrastructure**: External integrations (Govee API, Stream Deck storage)

### Stream Deck Plugin Architecture
- Uses `@elgato/streamdeck` SDK with TypeScript decorators
- Actions extend `SingletonAction` class with typed settings
- Property Inspectors use SDPI Components for UI (HTML files in `ui/` directory)
- Plugin manifest at `com.felixgeelhaar.govee-light-management.sdPlugin/manifest.json`

### Enterprise Govee API Integration
- **Client Library**: Uses `@felixgeelhaar/govee-api-client` v2.0.0 for enterprise-grade API access
- **Features**: Rate limiting, retry logic with exponential backoff, circuit breaker pattern
- **Error Handling**: Comprehensive error hierarchy with specific error types
- **Performance**: Built-in metrics and monitoring for production environments
- **Type Safety**: Full TypeScript support with domain-driven value objects

### Build System
- **Rollup** configuration in `rollup.config.mjs`
- TypeScript compilation with ES2022 modules
- Source maps in development mode
- Automatic plugin file emission and manifest watching
- Terser minification in production builds

### Testing Commands Integration
- Run tests before building: `npm run test && npm run build`
- Pre-commit hooks ensure tests pass and code quality standards are met
- CI/CD pipeline integration ready with comprehensive test suite

### Build System Roadmap
- **Current**: Rollup-based build system with TypeScript compilation
- **Planned Migration**: Switch from Rollup to Vite for improved development experience
  - Faster hot reload and development server
  - Better TypeScript integration and error reporting
  - Improved plugin ecosystem and modern tooling
  - Enhanced build performance for large codebases
  - Native ESM support with better tree-shaking

### UI Components
- HTML-based property inspectors using SDPI Components v4
- Real-time data binding between plugin and UI
- Dynamic data source population for dropdowns
- Comprehensive error handling and user feedback

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
tests/
├── unit/
│   ├── domain/
│   │   ├── entities/
│   │   └── services/
│   └── infrastructure/
└── integration/
    ├── repositories/
    └── actions/
```

### Testing Tools
- **Vitest**: Fast unit testing framework with TypeScript support
- **Playwright**: E2E testing for Stream Deck property inspectors
- **Coverage**: v8 coverage reporting with detailed metrics

## Key Patterns

### Domain-Driven Design Implementation
- **Entities**: `Light`, `LightGroup` with business logic and invariants
- **Value Objects**: Leverage @felixgeelhaar/govee-api-client's `Brightness`, `ColorRgb`, `ColorTemperature`
- **Repositories**: Interface-based data access with concrete implementations
- **Services**: Domain and application services for complex operations

### Action Registration
Actions are registered in `plugin.ts` using the Stream Deck SDK:
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