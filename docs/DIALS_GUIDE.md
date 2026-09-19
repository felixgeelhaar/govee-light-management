# Stream Deck+ Dials Marketing Guide

## Hero Title

**Tactile Smart Light Control: Stream Deck+ Dials for Govee Lights**

---

## Overview

Turn your Stream Deck+ dials into tactile smart light controllers. Rotate to adjust, press to toggle — all with instant visual feedback and zero latency. Every dial reads the actual state of your lights when it appears, so you always start from reality.

---

## The Five Dial Actions

### 🔆 Brightness Dial

**Adjust light brightness with tactile precision.**

**What it does:**

- Rotate clockwise to brighten (0-100%)
- Rotate counter-clockwise to dim
- Press dial to toggle power on/off
- Visual feedback: Purple-to-blue gradient bar shows current level

**Perfect for:**

- Ambient lighting control during video calls
- Movie mood lighting (subtle dimming)
- Working sessions (bright mode for focus, dim for evening)

**Configuration:**

- Choose brightness sensitivity (1-25% per rotation tick, default: 5%)
- Select your light or light group
- See live brightness when the dial appears

**Example workflow:**

1. Scene is too bright for a video call → rotate dial to dim
2. Dial instantly shows new brightness while light catches up
3. Press dial to completely turn off during the call

---

### 🌡️ Color Temperature Dial

**Switch from warm cozy white to crisp cool daylight with one dial.**

**What it does:**

- Rotate clockwise for cooler white, up to your light's coolest setting
- Rotate counter-clockwise for warmer white, down to its warmest
- Press dial to toggle power on/off
- Visual feedback: Warm amber-to-cool blue gradient

**Perfect for:**

- Time-based lighting (warm morning, cool midday, warm evening)
- Working conditions (cool white for focus, warm for relaxation)
- Video conferencing (adjust lighting for video quality)

**Configuration:**

- Choose temperature sensitivity (50-500K per tick, default: 100K)
- Select your light or light group
- Live temperature display on appear

**Color range:**

The dial travels the range your light reports to Govee — commonly
2700K–6500K, wider on some models. For a group it spans every member's
range, and each light stops at its own limit. A light that reports no
range gets a safe 2700K–6500K.

- 2700K: Warm white (orange-amber)
- 4000K: Neutral warm white
- 6500K: Cool daylight white

**Example workflow:**

1. Sun goes down → rotate dial from cool to warm
2. Watch the gradient bar smoothly transition from blue to amber
3. Lights adjust to match the color you've dialed in

---

### 🌈 Color Hue Dial

**Paint your room with any color on the 360° spectrum.**

**What it does:**

- Rotate through the full 360° color wheel
- Press dial to toggle power on/off
- Visual feedback: Rainbow gradient bar with position indicator
- Live hue display in degrees (0-360°)

**Perfect for:**

- Party and entertainment lighting
- Themed lighting for content creation
- Artistic mood lighting
- Color-coded automation (red=focused, green=break time, blue=creative)

**Configuration:**

- Choose hue sensitivity (1-90° per tick, default: 15°)
- Set saturation level (0-100% color intensity, default: 100%)
- Select your light or light group
- Choose between clamped rotation (0-360°) or continuous wrapping

**Color wheel positions:**

- 0° / 360°: Red (passion, alert)
- 60°: Yellow (energy, creativity)
- 120°: Green (calm, focus, growth)
- 180°: Cyan (fresh, cool, clarity)
- 240°: Blue (calm, professional)
- 300°: Magenta (creative, bold)

**Example workflow:**

1. Creative work session starts → set hue to green (120°)
2. Need to focus? Rotate to blue (240°)
3. Party time? Cycle through reds and magentas
4. Watch the rainbow gradient bar follow your selection

---

### 🎨 Saturation Dial

**Control color intensity from pure white to full saturation.**

**What it does:**

- Rotate to adjust saturation from 0% (white) to 100% (full color)
- Press dial to toggle power on/off
- Visual feedback: Shows color intensity with gradient bar
- Perfect companion to the Hue dial

**Perfect for:**

- Fine-tuning accent lighting (pastels vs vivid colors)
- Gradual color transitions (white → pastel → full color)
- Mood lighting adjustments
- Combining with hue dial for precise color control

**Configuration:**

- Choose saturation sensitivity (1-10% per tick, default: 2%)
- Select your light or light group
- Live saturation percentage display

**Example workflow:**

1. Set hue dial to your preferred color
2. Use saturation dial to adjust intensity
3. Full saturation (100%) for vibrant party lighting
4. Low saturation (20%) for subtle accent lighting

---

### 🎨 Segment Color Dial

**Control individual RGB IC light segments with precision.**

**What it does:**

- Rotate to select hue (0-360°)
- Press dial to apply color to selected segment
- Visual feedback: Rainbow gradient with segment preview
- Works with 15-segment RGB IC light strips

**Perfect for:**

- RGB strip accent lighting
- Per-segment color control (rainbow strips, gradient effects)
- Creating custom segment patterns
- Fine-tuning individual light segments

**Configuration:**

- Choose which segment (1-15) to control
- Set hue sensitivity (1-90° per tick, default: 15°)
- Set saturation (0-100%, default: 100%)
- Select your RGB IC light strip
- Live color preview shows selected segment color

**Example workflow:**

1. Have a 15-segment RGB light strip behind monitor
2. Use dial to set hue
3. Press to apply color to segment 1
4. Rotate dial in segment selector, reapply to segment 2
5. Build custom rainbow or gradient pattern step by step

---

## Common Dial Features

### Live State Sync

Every dial reads the actual current state of your light when it appears on screen. No defaults, no guesses — just reality.

**Example:**

- Light is currently at 60% brightness
- Brightness dial appears showing 60%
- You can immediately rotate from the actual position

### Deferred Updates

The dial display updates instantly (so rotation feels smooth), while the actual light command is sent in the background. Zero lag, responsive feel.

### Power Toggle

Press any dial to toggle power on/off instantly — same as tapping the On/Off keypad action.

### Visual Feedback

- **Green flash**: Command succeeded ✓
- **Red flash**: Error occurred (check API key, network, light online)

### Group Support (v2.1.3+)

All dials work with light groups:

- Create groups in the Group Control action
- Select a group in the dial property inspector
- Dial controls all lights in the group simultaneously
- Live state reflects the combined group state

---

## Dial Configuration Tips

### Setting the Right Sensitivity

**Brightness Dial:**

- Large room or far from light? Try 10% per tick (coarser control)
- Close proximity? 2-3% per tick (fine-tuning)

**Color Temperature Dial:**

- Want to make big jumps? 200K per tick
- Fine-tuning? 50K per tick (small steps)

**Color Hue Dial:**

- Quick color changes? 45° per tick (every color in 8 rotations)
- Precise color control? 5-10° per tick

### Grouping Strategy

**Single light per dial:**

- Best for: Dedicated controls (one dial per light)
- Example: Reading lamp brightness → dedicated dial

**Group per dial:**

- Best for: Room-wide controls
- Example: Bedroom group → one brightness dial, one color dial

**Multiple dials per light:**

- Best for: Different aspects of the same light
- Example: RGB bulb → brightness dial + hue dial + saturation dial

---

## Real-World Scenarios

### Video Conferencing Setup

1. **Brightness Dial** on encoder 1 — adjust for optimal camera exposure
2. **Color Temperature Dial** on encoder 2 — warm up lighting to look natural on camera
3. **Hue Dial** on encoder 3 — add subtle accent lighting
4. Press any dial to kill lights during screen sharing

### Creative Work Station

1. **Brightness Dial** — adjust illumination for fine detail work
2. **Color Temperature Dial** — switch from cool (focus) to warm (eye rest)
3. **Hue Dial** — set scene color based on work type (green=calm, blue=focused, red=energetic)
4. All grouped into a single "Desk Light" group

### Home Theater

1. **Brightness Dial** for accent lights — dim during movie
2. **Color Hue Dial** for RGB strips — match color to on-screen content
3. **Saturation Dial** for subtle background — adjust intensity based on scene
4. Press dials to kill all lights when credits start

### RGB Strip Customization

1. Create segments: left side (segs 1-5), center (6-10), right side (11-15)
2. Use Segment Color Dial to paint each section
3. Hold and rotate to create gradient effects
4. Save favorite patterns by taking a photo

---

## FAQ

**Q: Can I use the same light with multiple dials?**
A: Yes! Use different dials for different properties (brightness + color hue + color temperature on same light).

**Q: What happens if my light is offline?**
A: The dial shows the last known state and displays a red flash when you try to command it. It will retry automatically.

**Q: Do dials work with groups?**
A: Yes! All dials support groups (v2.1.3+). Create a group, select it in the property inspector, and control all lights together.

**Q: Can I adjust dials while the light is off?**
A: Yes, the dial adjusts and remembers the value. When you turn the light on, it applies that setting.

**Q: Which lights support color control?**
A: Any Govee light with color capability. Check in the Govee Home app or try a color dial — it will only show compatible lights.

**Q: How do I know which segment is which?**
A: Segments are numbered 1-15 left to right on most RGB IC strips. The property inspector shows a preview.

---

## Compatibility Matrix

| Feature | Stream Deck | Stream Deck MK.2 | Stream Deck+ | Stream Deck XL | Stream Deck Mini |
| ------- | :---------: | :--------------: | :----------: | :------------: | :--------------: |
| Dials   |     ❌      |        ❌        |      ✅      |       ❌       |        ❌        |
| Buttons |     ✅      |        ✅        |      ✅      |       ✅       |        ✅        |

---

## Getting Started with Dials

1. **Open Stream Deck+** software
2. **Select an encoder slot** (one of the 4 dials)
3. **Find "Govee Light Management"** in the actions list
4. **Choose a dial action:**
   - Brightness Dial
   - Color Temperature Dial
   - Color Hue Dial
   - Saturation Dial
   - Segment Color Dial
5. **Enter your Govee API key**
6. **Select your light**
7. **Configure sensitivity** (optional)
8. **Done!** The dial is ready to use

---

## Pro Tips

- **Combine dials in sequences**: Brightness → Color Temp → Hue for complete light control
- **Use groups for whole rooms**: One group per room means 2-3 dials control everything
- **Press to toggle**: Don't rotate if you just want to turn the light off — just press the dial
- **Watch the feedback bar**: The visual indicator tells you exactly where you are in the range
- **Experiment with sensitivity**: Lower sensitivity (1-2%) for precise control, higher (10-25%) for quick changes

---

## Troubleshooting

**Dial shows error (red flash):**

- Check API key is valid
- Verify light is online in Govee Home app
- Check network connectivity

**Dial doesn't show up:**

- Ensure you're using Stream Deck+ (not regular Stream Deck)
- Reload the action property inspector (close/reopen)
- Check for plugin updates

**Light doesn't respond to dial:**

- Verify light supports the control type (e.g., color lights for Hue dial)
- Check if light is in a scene or music mode (some states block commands)
- Try power-toggling the light, then dial again

---

_Version 2.1.3 — Stream Deck+ Dials Guide_
_For Stream Deck software 6.9+_
