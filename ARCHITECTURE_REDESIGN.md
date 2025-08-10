# Govee Light Management - Elgato-Style Architecture Redesign

## Overview

Redesigning the plugin to follow Elgato Control Center patterns with separate, focused actions that support both Stream Deck classic buttons and Stream Deck+ dials/touchscreens.

## New Action Structure

### 1. Toggle On/Off Action
- **UUID**: `com.felixgeelhaar.govee-light-management.toggle`
- **Purpose**: Simple power control - turn lights on/off or toggle
- **Controllers**: `["Keypad", "Encoder"]`  
- **Settings**: Target (single light or group), operation mode (on/off/toggle)
- **Dial Behavior**: Push to toggle, touch to toggle
- **Layout**: `$X1` (Icon layout with title)

### 2. Brightness Action  
- **UUID**: `com.felixgeelhaar.govee-light-management.brightness`
- **Purpose**: Control brightness with visual feedback
- **Controllers**: `["Keypad", "Encoder"]`
- **Settings**: Target (single light or group), step size, min/max values
- **Dial Behavior**: Rotate to adjust brightness, push to toggle on/off
- **Layout**: `$B1` (Value with indicator bar)
- **Touchscreen**: Shows current brightness percentage and bar

### 3. Color Action
- **UUID**: `com.felixgeelhaar.govee-light-management.color`  
- **Purpose**: RGB color control with presets
- **Controllers**: `["Keypad", "Encoder"]`
- **Settings**: Target (single light or group), color presets, cycling mode
- **Dial Behavior**: Rotate through color wheel/presets, push to apply
- **Layout**: `$A0` (Full canvas for color preview)
- **Touchscreen**: Color wheel or preset swatches

### 4. Color Temperature (Warmth) Action
- **UUID**: `com.felixgeelhaar.govee-light-management.warmth`
- **Purpose**: White balance control (cool to warm)
- **Controllers**: `["Keypad", "Encoder"]`  
- **Settings**: Target (single light or group), temperature range (2000K-9000K)
- **Dial Behavior**: Rotate to adjust warmth, push to toggle on/off
- **Layout**: `$B2` (Gradient indicator - blue to orange)
- **Touchscreen**: Shows temperature in Kelvin with gradient bar

## Shared Components

### Target Selection System
- **Universal Settings**: Each action can target either:
  - Single light (device selection dropdown)
  - Light group (group selection dropdown)
- **Shared Property Inspector**: Common target selection component
- **Dynamic Icons**: Action icons update to show light/group status

### API Integration Layer
- **Shared Services**: All actions use same API client and repository pattern
- **State Management**: Centralized light state tracking across actions
- **Error Handling**: Consistent error reporting via status field

### Stream Deck+ Features

#### Dial Support
- **Encoder Events**: `onDialRotate`, `onDialUp`, `onDialDown`, `onTouchTap`
- **Trigger Descriptions**: Clear interaction hints for each action
- **Haptic Feedback**: Visual and tactile response to user input

#### Touchscreen Layouts
- **Built-in Layouts**: Leverage Elgato's proven UX patterns
- **Dynamic Updates**: Real-time feedback via `setFeedback()`
- **Custom Elements**: Color previews and gradient indicators

## Migration Strategy

### Phase 1: Create New Actions (Current)
1. Implement 4 new action classes
2. Create focused property inspectors  
3. Update manifest with new action definitions
4. Add Stream Deck+ controller support

### Phase 2: Preserve Existing Data
1. Migrate existing light/group selections
2. Convert control mode settings to appropriate actions
3. Preserve API keys and configuration

### Phase 3: Deprecate Old Actions
1. Mark old actions as legacy in manifest
2. Add migration prompts to old property inspectors
3. Eventually remove old actions in future version

## Benefits

### User Experience
- **Intuitive**: Each action has single, clear purpose
- **Stream Deck+ Optimized**: Full dial and touchscreen support
- **Consistent**: Follows Elgato's established patterns
- **Flexible**: Works with both individual lights and groups

### Developer Experience  
- **Maintainable**: Smaller, focused codebases per action
- **Extensible**: Easy to add new control types
- **Testable**: Each action can be tested in isolation
- **Standards Compliant**: Follows Elgato SDK best practices

## Implementation Notes

### Manifest Updates
```json
{
  "Actions": [
    {
      "Name": "Toggle On/Off",
      "UUID": "com.felixgeelhaar.govee-light-management.toggle",
      "Controllers": ["Keypad", "Encoder"],
      "Encoder": {
        "layout": "$X1",
        "TriggerDescription": {
          "Push": "Toggle Light",
          "Touch": "Toggle Light"
        }
      }
    },
    {
      "Name": "Brightness",  
      "UUID": "com.felixgeelhaar.govee-light-management.brightness",
      "Controllers": ["Keypad", "Encoder"],
      "Encoder": {
        "layout": "$B1",
        "TriggerDescription": {
          "Push": "Toggle On/Off",
          "Rotate": "Adjust Brightness",
          "Touch": "Toggle On/Off"
        }
      }
    }
    // ... color and warmth actions
  ]
}
```

### Shared TypeScript Types
```typescript
interface TargetSettings {
  targetType: 'light' | 'group';
  lightId?: string;
  lightModel?: string;
  lightName?: string;
  groupId?: string;
  groupName?: string;
}

interface ActionSettings extends TargetSettings {
  // Action-specific settings extend this base
}
```

This redesign provides a modern, Elgato-standard architecture that maximizes the Stream Deck+ capabilities while maintaining backward compatibility and following enterprise software patterns.