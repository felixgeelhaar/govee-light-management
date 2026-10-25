# Marketplace Gallery Templates

These HTML files render at exactly **1920×1080** using the real plugin icons.
Open each in a browser and take a screenshot to produce marketplace gallery images — no AI image generation required.

## How to capture

### Option 1: Chrome headless (recommended, pixel-perfect)

```bash
cd docs/gallery
for page in 1-hero 2-actions 3-dials 4-setup 5-v21-features 6-v22-features 7-v3-features 8-lan; do
  /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
    --headless --disable-gpu --hide-scrollbars \
    --window-size=1920,1080 \
    --screenshot=$page.png \
    file://$PWD/$page.html
done
```

### Option 2: Manual screenshot

1. Open each HTML file in Chrome
2. Open DevTools → toggle device toolbar (Cmd+Shift+M)
3. Set to "Responsive" with exact dimensions 1920×1080
4. Right-click the page → "Capture full size screenshot"

### Option 3: Playwright

```bash
npx playwright screenshot --viewport-size=1920,1080 \
  file://$(pwd)/docs/gallery/1-hero.html gallery-1.png
```

## Files

| File                  | Purpose                                                   |
| --------------------- | --------------------------------------------------------- |
| `1-hero.html`         | Hero shot with headline + 4 action icons                  |
| `2-actions.html`      | All 8 keypad actions in a 4×2 grid                        |
| `3-dials.html`        | Stream Deck+ dial experience with touchscreen layouts     |
| `4-setup.html`        | 3-step setup walkthrough                                  |
| `5-v21-features.html` | New in v2.1 — Scenes, Music Mode, Feature Toggle showcase |
| `6-v22-features.html` | v2.7 group state (shows the retired ●/◐/○ glyphs; replace with 7 and 8) |
| `7-v3-features.html`  | New in v3 — key art, local-time schedules, groups everywhere, group effects |
| `8-lan.html`          | New in v3.1 — local network control, measured LAN vs cloud send time |

Upload the captured PNGs to the Elgato Marketplace listing (minimum 3, no cropped info).
