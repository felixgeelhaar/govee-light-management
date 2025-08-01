# Elgato Marketplace Submission Guide

This guide provides comprehensive instructions for submitting the Govee Light Management plugin to the Elgato Marketplace.

## Prerequisites

Before submitting to the marketplace, ensure you have:

1. **Maker Account**: Register as a Maker at [marketplace.elgato.com](https://marketplace.elgato.com/)
2. **Tested Plugin**: Thoroughly test on multiple Stream Deck models and operating systems
3. **Valid Release**: Create a release using our GitHub Actions workflow
4. **Marketing Assets**: Prepare screenshots and promotional materials

## Automated Preparation

Our GitHub Actions workflow automatically prepares your submission when you create a release:

1. **Create a Release Tag**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **Download Marketplace Submission Package**
   - Go to the Actions tab on GitHub
   - Find the release workflow run for your tag
   - Download the `marketplace-submission` artifact
   - Extract the contents

The package includes:
- `govee-light-management.streamDeckPlugin` - The validated plugin package
- `marketplace-metadata.json` - Metadata for your submission
- `SUBMISSION_CHECKLIST.md` - Step-by-step submission checklist
- `README.md` - Documentation
- `LICENSE` - License file

## Manual Submission Process

### 1. Access Maker Console

1. Navigate to [marketplace.elgato.com](https://marketplace.elgato.com/)
2. Click "Sign In" and select "I'm a Maker"
3. Log in with your Maker credentials

### 2. Create New Submission

1. Click "Submit New Plugin"
2. Upload `govee-light-management.streamDeckPlugin`
3. The system will automatically extract basic information

### 3. Fill Plugin Information

#### Basic Information
- **Name**: Govee Light Management
- **Version**: Use the version from your release tag
- **Category**: Smart Home > Lighting
- **Price**: Free (or set your pricing)

#### Description
Use this template and customize as needed:

```markdown
Control your Govee smart lights directly from your Stream Deck with this enterprise-grade plugin.

## Key Features
- 🔆 **Individual Light Control**: Toggle, adjust brightness, and change colors
- 👥 **Group Management**: Control multiple lights simultaneously
- 🎨 **Advanced Color Control**: RGB color picker and temperature adjustment
- 📊 **Real-time Monitoring**: See current light states at a glance
- ⚡ **Fast Performance**: Optimized API calls with caching
- 🔒 **Secure**: API key stored safely in Stream Deck

## Requirements
- Govee API Key (free from developer.govee.com)
- Stream Deck Software 6.0 or later
- Compatible Govee smart lights

## Support
- Documentation: [GitHub Repository](https://github.com/felixgeelhaar/govee-light-management)
- Issues: [GitHub Issues](https://github.com/felixgeelhaar/govee-light-management/issues)
```

#### Tags
Add relevant tags to help users find your plugin:
- govee
- smart-lights
- smart-home
- lighting
- automation
- iot
- home-automation

### 4. Add Visual Assets

#### Required Images
1. **Plugin Icon** (512x512px)
   - Use the high-resolution version from `assets/icon@2x.png`
   - Ensure transparent background

2. **Hero Image** (1920x1080px)
   - Showcase the plugin in action
   - Include Stream Deck with buttons visible

3. **Screenshots** (minimum 3)
   - Property Inspector configuration
   - Different button states (on/off)
   - Group management interface
   - Color picker in action

#### Image Guidelines
- Use high-quality images (PNG format preferred)
- Show real usage scenarios
- Include captions explaining features
- Ensure text is readable

### 5. Testing Information

Provide testing details for reviewers:

```
Testing Steps:
1. Install the plugin
2. Get a Govee API key from developer.govee.com
3. Add a Light Control action to Stream Deck
4. Enter API key in Property Inspector
5. Select a light from the dropdown
6. Test toggle, brightness, and color controls

Test Accounts:
- Govee API keys are free and personal
- Testers need their own Govee account and devices
- Plugin works with mock devices in Govee app for testing
```

### 6. Set Compatibility

- **Stream Deck Models**: All models supported
  - ✅ Stream Deck
  - ✅ Stream Deck Mini
  - ✅ Stream Deck XL
  - ✅ Stream Deck Mobile
  - ✅ Stream Deck Pedal
  - ✅ Stream Deck +

- **Operating Systems**:
  - ✅ Windows 10/11
  - ✅ macOS 10.15+
  - ❌ Linux (not officially supported by Stream Deck)

### 7. Review and Submit

1. Review all information for accuracy
2. Check "I agree to the Marketplace terms"
3. Click "Submit for Review"

## After Submission

### Review Process
- **Timeline**: Usually 5-10 business days
- **Communication**: Via email to your Maker account
- **Status**: Check Maker Console for updates

### Common Review Feedback
- Missing error handling for API failures
- Insufficient documentation
- UI/UX improvements needed
- Performance optimizations required

### Beta Testing
Consider joining the Marketplace Maker Discord for:
- Beta testing opportunities
- Feedback from other developers
- Direct communication with Elgato team

## Updating Your Plugin

1. Make necessary changes
2. Increment version in `manifest.json`
3. Create new release tag
4. Submit update through Maker Console
5. Reference previous version in update notes

## Marketing Your Plugin

Once approved:
1. **Announce** on social media
2. **Create** tutorial videos
3. **Engage** with Stream Deck communities
4. **Monitor** user feedback and reviews
5. **Update** regularly with new features

## Support Resources

- **Maker Documentation**: [docs.elgato.com](https://docs.elgato.com/streamdeck)
- **Maker Discord**: Available after first submission
- **Support Email**: maker@elgato.com (for existing Makers)
- **Community Forums**: [reddit.com/r/elgato](https://reddit.com/r/elgato)

## Troubleshooting

### Plugin Validation Fails
- Run `npx streamdeck validate` locally
- Check manifest.json for errors
- Ensure all required files are present

### Submission Rejected
- Address all feedback points
- Test thoroughly on fresh installation
- Improve documentation if requested
- Resubmit with detailed change notes

### Slow Review Process
- Ensure submission is complete
- Check spam folder for emails
- Contact maker@elgato.com if over 2 weeks

## Checklist

Before submitting, verify:
- [ ] Plugin works on Windows and macOS
- [ ] All features documented in README
- [ ] Error handling for common scenarios
- [ ] Property Inspector is user-friendly
- [ ] Icons display correctly at all sizes
- [ ] No console errors in production
- [ ] API key handling is secure
- [ ] Performance is optimized
- [ ] Version number is correct
- [ ] License is included

---

*For the latest information, always refer to the official [Elgato documentation](https://docs.elgato.com/streamdeck).*