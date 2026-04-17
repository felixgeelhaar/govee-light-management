# Pull Request

## Description

<!--- Provide a general summary of your changes in the Title above -->
<!--- Describe your changes in detail -->

## 🎯 Hardware Dogfood (required for any behavior change)

<!---
Every behavior-changing PR must describe **end-to-end testing on real Govee
hardware through the Stream Deck app** — not just "npm test passes". Unit
tests caught zero of the bugs shipped in v2.1.4–v2.2.0; dogfooding catches
first-click bugs that contributors otherwise have to find for us.

Skip this section ONLY for pure docs/CI/refactor PRs with zero runtime
impact.
-->

### I tested the following specific flows on real hardware

<!-- Describe concrete actions, not generic checkmarks. e.g.:
  - Added Custom Effect action to button, selected 'Pulse' preset,
    pressed key — saw H6008 light pulse through red→blue→green
  - Added Snapshot action with H60B0 (has no snapshots), opened PI —
    saw "No snapshots found" hint instead of empty dropdown
-->

1.
2.

### Hardware / Stream Deck model tested

-

### Stream Deck app version

-

### If this touches a Property Inspector dropdown or datasource

- [ ] The dropdown populates when there are items
- [ ] The dropdown shows a `.field-hint` when the backend returns `status: "empty"` (no misleading "Select a device first")
- [ ] The dropdown shows a `.field-hint` when the backend returns `status: "error"`
- [ ] I added/updated an E2E test in `test/e2e/` covering the new wiring (see `dependent-dropdowns.spec.ts` for the pattern)

## Type of Change

<!--- Put an `x` in all the boxes that apply: -->

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🎨 Style/formatting changes (no code logic changes)
- [ ] ♻️ Code refactoring (no functional changes)
- [ ] ⚡ Performance improvements
- [ ] 🧪 Test additions or modifications
- [ ] 🔧 Build/CI changes
- [ ] 🏗️ Infrastructure changes

## Related Issues

<!--- Link to the issue(s) this PR addresses -->
<!--- Use "Fixes #123" or "Closes #123" to auto-close issues when merged -->

- Fixes #(issue number)
- Related to #(issue number)

## Changes Made

<!--- Describe the changes you made in detail -->
<!--- Use bullet points for clarity -->

-
-
-

## Screenshots

<!--- If your changes affect the UI, please provide screenshots -->
<!--- Delete this section if not applicable -->

| Before         | After         |
| -------------- | ------------- |
| ![Before](url) | ![After](url) |

## Testing

<!--- Describe the tests that you ran to verify your changes -->
<!--- Provide instructions so we can reproduce -->

### Test Environment

- **OS**:
- **Stream Deck Version**:
- **Plugin Version**:
- **Node.js Version**:

### Test Cases

- [ ] Unit tests pass (`npm test`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Plugin installs correctly
- [ ] Plugin functions as expected in Stream Deck

### Manual Testing Performed

<!--- Describe what you manually tested -->

- [ ] Light control functionality
- [ ] Group management (create/edit/delete)
- [ ] Property Inspector UI
- [ ] Error handling
- [ ] API key validation
- [ ] State management
- [ ] Other: **\*\***\_\_\_**\*\***

## Performance Impact

<!--- Describe any performance implications -->

- [ ] No performance impact
- [ ] Minimal performance impact
- [ ] Significant performance changes (please describe below)

## Breaking Changes

<!--- If this is a breaking change, describe what breaks and how to migrate -->
<!--- Delete this section if no breaking changes -->

### What breaks:

### Migration guide:

## Checklist

<!--- Go over all the following points, and put an `x` in all the boxes that apply -->

### Code Quality

- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes

### Documentation

- [ ] I have updated the README.md if needed
- [ ] I have updated the CONTRIBUTING.md if needed
- [ ] I have added/updated JSDoc comments for new/modified functions
- [ ] I have added/updated examples if applicable

### Backwards Compatibility

- [ ] My changes maintain backwards compatibility
- [ ] If breaking changes exist, I have documented them above
- [ ] I have considered the impact on existing users

### Security

- [ ] My changes do not introduce security vulnerabilities
- [ ] I have not exposed sensitive information (API keys, credentials, etc.)
- [ ] I have followed secure coding practices

## Additional Notes

<!--- Add any additional notes, concerns, or questions for reviewers -->

## Reviewer Guidelines

<!--- For reviewers: Please check the following -->

### For Reviewers

- [ ] Code quality and style
- [ ] Test coverage
- [ ] Documentation completeness
- [ ] Performance considerations
- [ ] Security implications
- [ ] Backwards compatibility
- [ ] Manual testing (if UI changes)

---

**Thank you for contributing to Govee Light Management! 🚀**
