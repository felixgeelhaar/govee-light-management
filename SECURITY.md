# Security Policy

## Supported Versions

We actively support and provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Security Considerations

### API Key Handling

- **Storage**: API keys are stored securely in Stream Deck's settings system
- **Transmission**: All API communications use HTTPS encryption
- **Scope**: Keys are only used for Govee API interactions
- **Access**: Keys are never logged or transmitted to third parties

### Data Privacy

- **Local Processing**: All light control happens locally through your network
- **No Analytics**: We don't collect usage analytics or personal data
- **No Cloud Storage**: Settings and groups are stored locally on your device
- **Network Security**: All communications respect your local network security

### Dependencies

- **Regular Updates**: Dependencies are updated weekly via Dependabot
- **Security Audits**: Automated security scanning on all dependencies
- **Minimal Dependencies**: We maintain a minimal dependency footprint
- **Trusted Sources**: Only well-maintained packages from reputable sources

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly:

### Where to Report

**For security vulnerabilities, please email:** [security@geelhaar.dev](mailto:security@geelhaar.dev)

**Do NOT create a public GitHub issue for security vulnerabilities.**

### What to Include

When reporting a security vulnerability, please include:

1. **Description**: Clear description of the vulnerability
2. **Impact**: Potential impact and severity assessment
3. **Steps to Reproduce**: Detailed steps to reproduce the issue
4. **Environment**: Your environment details (OS, Stream Deck version, plugin version)
5. **Proof of Concept**: If applicable, a proof of concept (please be responsible)
6. **Suggested Fix**: If you have ideas for fixing the issue

### Response Timeline

- **Initial Response**: Within 24 hours of receiving your report
- **Triage**: Within 72 hours we'll provide a severity assessment
- **Resolution**: Security patches will be prioritized based on severity:
  - **Critical**: Within 24-48 hours
  - **High**: Within 1 week
  - **Medium**: Within 2 weeks
  - **Low**: Next scheduled release

### Disclosure Policy

- **Coordinated Disclosure**: We practice responsible coordinated disclosure
- **Public Disclosure**: Vulnerabilities will be publicly disclosed after patches are available
- **Credit**: Security researchers will be credited (unless they prefer anonymity)
- **Timeline**: We aim to resolve and disclose within 90 days of initial report

## Security Best Practices for Users

### API Key Security

1. **Generate Dedicated Keys**: Create a dedicated API key for Stream Deck use
2. **Regular Rotation**: Rotate your API keys periodically
3. **Monitor Usage**: Check your Govee account for unexpected API usage
4. **Secure Storage**: Don't share or store API keys in unsecured locations

### Network Security

1. **Secure Network**: Use the plugin on trusted, secure networks
2. **Firewall Rules**: Consider firewall rules if needed for your setup
3. **Update Regularly**: Keep Stream Deck software and the plugin updated
4. **Monitor Devices**: Regularly check connected Govee devices

### Plugin Security

1. **Official Sources**: Only install from official sources (GitHub releases, Stream Deck Store)
2. **Verify Checksums**: Verify file checksums when possible
3. **Regular Updates**: Install plugin updates promptly
4. **Review Permissions**: Understand what permissions the plugin requires

## Security Features

### Built-in Protections

- **Input Validation**: All user inputs are validated and sanitized
- **Rate Limiting**: Respects Govee API rate limits to prevent abuse
- **Error Handling**: Secure error handling that doesn't expose sensitive data
- **Dependency Scanning**: Automated dependency vulnerability scanning

### Development Security

- **Secure Development**: Following secure coding practices
- **Code Review**: All code changes go through security-aware review
- **Static Analysis**: Automated static analysis for security issues
- **Testing**: Security considerations in our testing strategy

## Security Updates

### Notification Channels

- **GitHub Releases**: Security updates are clearly marked in release notes
- **GitHub Security Advisories**: Critical vulnerabilities get security advisories
- **Stream Deck Store**: Updates are pushed through official channels

### Update Recommendations

- **Automatic Updates**: Enable automatic updates if available
- **Regular Checks**: Manually check for updates if auto-update is disabled
- **Release Notes**: Review release notes for security-related changes
- **Testing**: Test updates in a safe environment when possible

## Compliance and Standards

### Security Standards

- **OWASP Guidelines**: Following OWASP secure coding guidelines
- **Industry Best Practices**: Adhering to industry security best practices
- **Regular Audits**: Periodic security audits and assessments
- **Penetration Testing**: Regular security testing and vulnerability assessments

### Privacy Compliance

- **Data Minimization**: We collect and process minimal data
- **Purpose Limitation**: Data is only used for intended functionality
- **Transparency**: Clear documentation of data handling practices
- **User Control**: Users maintain control over their data and settings

## Third-Party Security

### Govee API

- **Encrypted Communication**: All API calls use HTTPS encryption
- **Authentication**: Secure API key-based authentication
- **Rate Limiting**: Respects official API rate limits
- **Error Handling**: Secure handling of API responses

### Stream Deck SDK

- **Official SDK**: Using official Elgato Stream Deck SDK
- **Secure Integration**: Following SDK security guidelines
- **Regular Updates**: Keeping SDK dependencies updated
- **Sandboxing**: Respecting Stream Deck's security boundaries

## Bug Bounty Program

Currently, we don't have a formal bug bounty program, but we greatly appreciate security researchers who responsibly disclose vulnerabilities. We provide:

- **Recognition**: Public credit for responsible disclosure
- **Direct Communication**: Direct line to the development team
- **Fast Response**: Prioritized response to security reports
- **Collaboration**: Opportunity to collaborate on fixes

## Contact Information

- **Security Email**: [security@geelhaar.dev](mailto:security@geelhaar.dev)
- **General Contact**: [felix@geelhaar.dev](mailto:felix@geelhaar.dev)
- **GitHub Issues**: For non-security bugs and feature requests
- **GitHub Discussions**: For community questions and discussions

---

**Last Updated**: July 30, 2025

We're committed to maintaining the security and privacy of our users. Thank you for helping us keep Govee Light Management secure!