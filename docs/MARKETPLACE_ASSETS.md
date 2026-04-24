# Marketplace Assets Guide

This document explains how to generate, manage, and upload marketplace assets for the Elgato Marketplace listing.

---

## Overview

Marketplace gallery images are generated from HTML templates using Chrome headless. This approach ensures:

- **Pixel-perfect accuracy** — Exactly 1920×1080 with no manual resizing
- **Consistent styling** — Uses shared CSS with plugin colors
- **Real assets** — Actual plugin SVG icons, not generic placeholders
- **Easy updates** — Just edit HTML, regenerate screenshots

---

## Current Assets

### Gallery Images (Required for Marketplace)

| File                 | Purpose                  | Status     | Resolution | Last Updated |
| -------------------- | ------------------------ | ---------- | ---------- | ------------ |
| `1-hero.png`         | Hero shot with headline  | ✅ Ready   | 1920×1080  | Apr 13, 2026 |
| `2-actions.png`      | All 12 keypad actions    | ✅ Ready   | 1920×1080  | Apr 14, 2026 |
| `3-dials.png`        | All 5 Stream Deck+ dials | ✅ Updated | 1920×1080  | Apr 17, 2026 |
| `4-setup.png`        | 3-step setup walkthrough | ✅ Ready   | 1920×1080  | Apr 9, 2026  |
| `5-v21-features.png` | New in v2.1 features     | ✅ Ready   | 1920×1080  | Apr 14, 2026 |
| `6-v22-features.png` | New in v2.2 features     | ✅ Ready   | 1920×1080  | Apr 17, 2026 |

**Upload all 6 images to Elgato Marketplace** — minimum 3 required, but all 6 provide complete feature showcase.

### Icon Assets (SVG)

Located in `docs/gallery/assets/`:

**Action Icons:**

- `brightness.svg` — Brightness action
- `colortemp.svg` — Color Temperature action
- `color.svg` — Color action
- `segment-color.svg` — Segment Color action
- `scene.svg` — Scene action (new in v2.1)
- `music-mode.svg` — Music Mode action (new in v2.1)
- `toggle.svg` — Feature Toggle action (new in v2.1)
- `snapshot.svg` — Snapshot action (new in v2.1.4)
- `schedule.svg` — Schedule action (new in v2.2)
- `sequence.svg` — Sequence action (new in v2.2)
- `custom-effect.svg` — Custom Effect action (new in v2.2)
- `light.svg` — Logo/brand icon

**Dial Icons:**

- `brightness-dial.svg` — Brightness Dial
- `colorhue-dial.svg` — Color Hue Dial
- `colortemp-dial.svg` — Color Temperature Dial
- `saturation-dial.svg` — Saturation Dial (new in v2.1.3)
- `segment-color-dial.svg` — Segment Color Dial

---

## Regenerating Gallery Images

### Prerequisites

```bash
# Install Google Chrome (if not already installed)
# macOS:
brew install google-chrome

# Or download from https://www.google.com/chrome/
```

### Method 1: Chrome Headless (Recommended)

Generates pixel-perfect PNG files from HTML templates:

```bash
cd docs/gallery

# Generate all images at once
for page in 1-hero 2-actions 3-dials 4-setup 5-v21-features 6-v22-features; do
  /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
    --headless --disable-gpu --hide-scrollbars \
    --window-size=1920,1080 \
    --screenshot=$page.png \
    file://$PWD/$page.html
done

# Verify images were created
ls -lh *.png
```

### Method 2: Playwright (Alternative)

If you prefer using Playwright (already in dev dependencies):

```bash
cd docs/gallery

# Generate images
npx playwright screenshot --viewport-size=1920,1080 \
  file://$(pwd)/1-hero.html 1-hero.png

npx playwright screenshot --viewport-size=1920,1080 \
  file://$(pwd)/2-actions.html 2-actions.png

# ... repeat for other images
```

### Method 3: Manual Screenshot

If automation doesn't work:

1. Open `docs/gallery/1-hero.html` in Chrome
2. Press **Cmd+Shift+M** (toggle device toolbar)
3. Set to "Responsive" → **1920×1080**
4. Right-click page → **Capture full size screenshot**
5. Repeat for each HTML file

---

## Marketplace Image Requirements

### Specifications

- **Format:** PNG (1920×1080)
- **File size:** <2MB each (typically 600-800KB)
- **Count:** Minimum 3, recommended 6
- **Language:** English (text/headers visible)
- **No cropping:** Show complete information
- **Quality:** No compression artifacts

### What Each Image Should Show

1. **1-hero.png** — Headline + visual appeal
   - "Tactile dial control" headline
   - Action icons or lights visual
   - Stream Deck branding

2. **2-actions.png** — Feature grid
   - All 12 keypad actions displayed
   - Icons with labels
   - Clear visual hierarchy

3. **3-dials.png** — Dial showcase
   - All 5 Stream Deck+ dials
   - Touchscreen feedback bars
   - Live state values
   - NEW: Saturation dial included

4. **4-setup.png** — Getting started
   - Step 1: Get API key
   - Step 2: Install plugin
   - Step 3: Configure action
   - Numbered steps with icons

5. **5-v21-features.png** — What's new in v2.1
   - Scene action highlight
   - Music Mode feature
   - Feature Toggle capability
   - Version number

6. **6-v22-features.png** — What's new in v2.2
   - Schedule action highlight
   - Sequence action
   - Custom Effect
   - Version number

---

## Editing Gallery Templates

Gallery images are HTML files in `docs/gallery/` that render at 1920×1080.

### Example: Adding a New Dial

Edit `3-dials.html`:

```html
<!-- In the <div class="dials"> section, add: -->
<div class="dial">
  <img class="dial-icon" src="./assets/my-new-dial.svg" alt="" />
  <div class="dial-panel">
    <div class="dial-label">My Feature</div>
    <div class="dial-value">42%</div>
    <div class="dial-bar" style="--v:42%; --grad: linear-gradient(...)"></div>
  </div>
  <div class="dial-name">My Dial</div>
</div>
```

### Styling Reference

Shared CSS variables in `shared.css`:

- `--bg` — Main background color
- `--text` — Primary text color
- `--muted` — Muted text color
- `--dim` — Dimmed text color
- `--border` — Border color
- `.grad-text` — Gradient text effect

---

## Uploading to Elgato Marketplace

### Step 1: Access Maker Console

1. Go to [Elgato Maker Console](https://maker.elgato.com/)
2. Sign in with Elgato account
3. Select "Govee Light Management" plugin
4. Navigate to "Gallery" section

### Step 2: Upload Images

1. Click "Upload New Image"
2. Select each PNG file in order:
   - 1-hero.png
   - 2-actions.png
   - 3-dials.png
   - 4-setup.png
   - 5-v21-features.png
   - 6-v22-features.png

3. Verify preview looks correct
4. Save changes

### Step 3: Verify Display

1. Preview marketplace listing
2. Check image order and clarity
3. Ensure no text is cropped
4. Verify all dials are visible in 3-dials.png

---

## Version Updates

### When to Update Gallery Images

**Update required when:**

- Adding new actions
- Changing UI significantly
- Adding new dials
- Updating plugin icons
- Version bump with new features

**Update recommended:**

- Every major/minor release
- After UI redesign
- Before marketplace submission

**No update needed for:**

- Patch versions (bug fixes only)
- Documentation changes
- Internal refactoring

### For v2.1.3 Specifically

✅ **3-dials.png** already updated to show Saturation dial
✅ **All other images** still accurate (no changes to actions/setup)

**Action required:** Regenerate PNG from updated 3-dials.html

```bash
cd docs/gallery
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless --disable-gpu --hide-scrollbars \
  --window-size=1920,1080 \
  --screenshot=3-dials.png \
  file://$PWD/3-dials.html
```

---

## File Structure

```
docs/
├── gallery/
│   ├── 1-hero.html               # Hero template
│   ├── 1-hero.png                # Generated screenshot
│   ├── 2-actions.html            # Actions template
│   ├── 2-actions.png             # Generated screenshot
│   ├── 3-dials.html              # Dials template (5 dials)
│   ├── 3-dials.png               # Generated screenshot
│   ├── 4-setup.html              # Setup template
│   ├── 4-setup.png               # Generated screenshot
│   ├── 5-v21-features.html       # Features template
│   ├── 5-v21-features.png        # Generated screenshot
│   ├── shared.css                # Shared styling
│   ├── README.md                 # This gallery guide
│   └── assets/                   # SVG icons
│       ├── brightness-dial.svg
│       ├── colorhue-dial.svg
│       ├── saturation-dial.svg   # NEW in v2.1.3
│       ├── colortemp-dial.svg
│       ├── segment-color-dial.svg
│       ├── scene.svg
│       ├── music-mode.svg
│       ├── toggle.svg
│       ├── brightness.svg
│       ├── colortemp.svg
│       ├── color.svg
│       ├── segment-color.svg
│       └── light.svg
```

---

## Troubleshooting

### Images Won't Generate

**Problem:** Chrome command not found

```bash
# Solution: Use full path or install Chrome
which google-chrome
# or: brew install google-chrome
```

**Problem:** Images are blank/white

```bash
# Solution: Add --force flag
--headless=new --force
```

**Problem:** Text is too small/large

```bash
# Solution: Edit HTML to adjust viewport or font sizes
# Then regenerate
```

### Images Are Blurry

**Problem:** Screenshots at wrong resolution

```bash
# Solution: Verify window-size parameter
--window-size=1920,1080  # Not 1920x1080
```

**Problem:** Using 2x display (Retina)

```bash
# Solution: Scale down in image editor or use --device-scale-factor=1
```

### Marketplace Upload Failed

**Problem:** File too large (>2MB)

```bash
# Solution: Compress PNG with imageoptim or pngquant
pngquant --quality=80-90 1-hero.png
```

**Problem:** Image dimensions incorrect

```bash
# Solution: Verify exactly 1920×1080
file 1-hero.png  # Check dimensions
```

---

## Best Practices

### Do's ✅

- **Regenerate before each release** — Ensures consistency
- **Test HTML files locally first** — Preview before generating
- **Keep SVG assets updated** — When icons change
- **Use consistent styling** — Follow shared.css patterns
- **Include version info** — In feature highlight images
- **Test marketplace preview** — After uploading images

### Don'ts ❌

- **Don't manually edit PNG files** — Regenerate from HTML instead
- **Don't use different resolutions** — All must be 1920×1080
- **Don't crop important info** — Show complete content
- **Don't use copyrighted media** — Only use plugin assets
- **Don't forget to upload** — Images need to be explicitly uploaded

---

## Automation Script

Create `scripts/generate-gallery.sh`:

```bash
#!/bin/bash
set -e

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
GALLERY="docs/gallery"

echo "📸 Generating marketplace gallery images..."

cd "$GALLERY"

pages=("1-hero" "2-actions" "3-dials" "4-setup" "5-v21-features")

for page in "${pages[@]}"; do
  echo "  → $page.png"
  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --window-size=1920,1080 \
    --screenshot="$page.png" \
    file://$PWD/"$page.html" 2>/dev/null
done

echo "✅ Gallery images generated successfully!"
echo ""
echo "Upload these files to Elgato Marketplace:"
ls -lh *.png | awk '{print "  • " $9 " (" $5 ")"}'
```

Run with:

```bash
chmod +x scripts/generate-gallery.sh
./scripts/generate-gallery.sh
```

---

## Questions?

Check:

- [Elgato Marketplace Guidelines](https://github.com/elgato/streamdeck-dist)
- [Stream Deck Plugin Documentation](https://docs.elgato.com/sdk)
- [Marketplace Support](https://support.elgato.com/)

---

_Last updated: April 17, 2026_
_For v2.1.3 with 5 Stream Deck+ dials_
