# Contributing to Govee Light Management

Thank you for your interest in contributing to the Govee Light Management Stream Deck plugin! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.0 or later)
- [Git](https://git-scm.com/)
- [Stream Deck Software](https://www.elgato.com/en/gaming/downloads) (for testing)
- [Stream Deck CLI](https://docs.elgato.com/sdk/getting-started/first-plugin)

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/govee-light-management.git
   cd govee-light-management
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Stream Deck CLI globally**
   ```bash
   npm install -g @elgato/cli
   ```

4. **Start development environment**
   ```bash
   npm run watch
   ```

5. **Install the plugin for testing**
   ```bash
   streamdeck install com.felixgeelhaar.govee-light-management.sdPlugin
   ```

## Development Workflow

### Branch Strategy

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: New features
- `bugfix/*`: Bug fixes
- `hotfix/*`: Critical production fixes

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the existing code style and conventions
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm test                    # Run unit tests
   npm run test:coverage       # Check test coverage
   npm run lint               # Check code style
   npm run type-check         # TypeScript type checking
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

   We follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` New features
   - `fix:` Bug fixes
   - `docs:` Documentation changes
   - `style:` Code style changes
   - `refactor:` Code refactoring
   - `test:` Test additions or modifications
   - `chore:` Maintenance tasks

5. **Push and create a Pull Request**
   ```bash
   git push origin feature/your-feature-name
   ```

## Code Style Guidelines

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Prefer composition over inheritance
- Use async/await over Promises where possible

### Architecture

We follow **Domain-Driven Design (DDD)** principles:

```
src/
├── actions/          # Stream Deck action handlers (Application Layer)
├── domain/           # Business logic (Domain Layer)
│   ├── entities/     # Business entities
│   ├── repositories/ # Repository interfaces
│   └── services/     # Domain services
└── infrastructure/   # External integrations (Infrastructure Layer)
    └── repositories/ # Repository implementations
```

### Best Practices

- **Single Responsibility**: Each class/function should have one reason to change
- **Dependency Injection**: Use constructor injection for dependencies
- **Error Handling**: Always handle errors gracefully with user-friendly messages
- **Type Safety**: Avoid `any` types, use proper TypeScript types
- **Testing**: Write tests for all business logic and public APIs

## Testing

### Unit Tests

```bash
npm test                # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Generate coverage report
```

### E2E Tests

```bash
npm run test:e2e        # Run end-to-end tests
npm run test:e2e:ui     # Run E2E tests with UI
```

### Testing Guidelines

- Write tests for all new features
- Maintain test coverage above 80%
- Use descriptive test names
- Test both success and error scenarios
- Mock external dependencies (Govee API, Stream Deck SDK)

## Documentation

### Code Documentation

- Add JSDoc comments for all public methods and classes
- Include parameter types and return values
- Provide usage examples for complex functions
- Document any assumptions or limitations

### User Documentation

- Update README.md for new features
- Add screenshots for UI changes
- Update troubleshooting section for known issues
- Include migration guides for breaking changes

## Submitting Changes

### Pull Request Process

1. **Ensure your branch is up to date**
   ```bash
   git checkout main
   git pull origin main
   git checkout feature/your-feature-name
   git rebase main
   ```

2. **Create a descriptive Pull Request**
   - Use a clear and descriptive title
   - Include a detailed description of changes
   - Reference any related issues
   - Add screenshots for UI changes
   - List any breaking changes

3. **Pull Request Template**
   ```markdown
   ## Description
   Brief description of changes made.

   ## Type of Change
   - [ ] Bug fix (non-breaking change that fixes an issue)
   - [ ] New feature (non-breaking change that adds functionality)
   - [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
   - [ ] Documentation update

   ## Testing
   - [ ] Unit tests pass
   - [ ] E2E tests pass
   - [ ] Manual testing completed

   ## Screenshots (if applicable)
   Include screenshots for UI changes.

   ## Checklist
   - [ ] Code follows project style guidelines
   - [ ] Self-review completed
   - [ ] Code is commented where necessary
   - [ ] Documentation updated
   - [ ] No new warnings or errors introduced
   ```

### Review Process

1. **Automated Checks**: All CI checks must pass
2. **Code Review**: At least one maintainer approval required
3. **Testing**: Manual testing for significant changes
4. **Documentation**: Ensure documentation is updated

## Issue Guidelines

### Bug Reports

Use the bug report template and include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Stream Deck version, plugin version)
- Screenshots or logs if applicable

### Feature Requests

Use the feature request template and include:
- Clear description of the desired feature
- Use case and motivation
- Proposed implementation (if any)
- Alternative solutions considered

### Issue Labels

- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Improvements or additions to documentation
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention is needed
- `question`: Further information is requested

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):
- `MAJOR`: Breaking changes
- `MINOR`: New features (backward compatible)
- `PATCH`: Bug fixes (backward compatible)

### Release Checklist

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create release branch
4. Run full test suite
5. Create and test release build
6. Tag release with git tag
7. Create GitHub release with notes
8. Publish to Stream Deck Store (if applicable)

## Community

### Getting Help

- 📖 Check the [Wiki](https://github.com/felixgeelhaar/govee-light-management/wiki)
- 💬 Join [GitHub Discussions](https://github.com/felixgeelhaar/govee-light-management/discussions)
- 🐛 Report issues via [GitHub Issues](https://github.com/felixgeelhaar/govee-light-management/issues)

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and community discussions
- **Pull Requests**: Code contributions and reviews
- **Email**: [felix@geelhaar.dev](mailto:felix@geelhaar.dev) for private matters

## Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes for significant contributions
- GitHub contributors graph
- Special thanks in commit messages

## License

By contributing to this project, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

Thank you for contributing to make Govee Light Management better for everyone! 🚀