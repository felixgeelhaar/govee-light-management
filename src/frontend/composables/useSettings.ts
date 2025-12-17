/**
 * Settings persistence and restoration composable
 * Handles Stream Deck settings synchronization with backend
 */

import { ref, reactive, watch, nextTick } from "vue";
import type {
  LightControlSettings,
  GroupControlSettings,
  SceneControlSettings,
  MusicModeSettings,
  SegmentColorDialSettings,
} from "@shared/types/settings";
import { websocketService } from "../services/websocketService";
import { createAppError, ErrorCodes, logError } from "../utils/errorHandling";

export type ActionSettings =
  | LightControlSettings
  | GroupControlSettings
  | SceneControlSettings
  | MusicModeSettings
  | SegmentColorDialSettings;

/**
 * Settings state interface
 */
interface SettingsState<T extends ActionSettings> {
  settings: T;
  isLoading: boolean;
  hasError: boolean;
  error: string | null;
  hasChanges: boolean;
  lastSaved: Date | null;
}

/**
 * Composable for managing Stream Deck action settings
 */
export function useSettings<T extends ActionSettings>(defaultSettings: T) {
  // Reactive state
  const state = reactive<SettingsState<T>>({
    settings: { ...defaultSettings },
    isLoading: false,
    hasError: false,
    error: null,
    hasChanges: false,
    lastSaved: null,
  });

  // Track original settings for change detection
  const originalSettings = ref<T>({ ...defaultSettings });

  /**
   * Load settings from Stream Deck on initialization
   */
  const loadSettings = async (): Promise<void> => {
    if (!websocketService.isConnected) {
      const error = createAppError(
        "Cannot load settings: WebSocket not connected",
        ErrorCodes.WEBSOCKET_CONNECTION_FAILED,
      );
      logError(error);
      return;
    }

    state.isLoading = true;
    state.hasError = false;
    state.error = null;

    try {
      // Get initial settings from WebSocket service
      const currentSettings = websocketService.getCurrentSettings();
      if (currentSettings) {
        const loadedSettings = currentSettings as T;

        // Merge with defaults to ensure all properties are present
        Object.assign(state.settings, {
          ...defaultSettings,
          ...loadedSettings,
        });

        // Update original settings for change tracking
        originalSettings.value = { ...state.settings };
        state.hasChanges = false;
        state.lastSaved = new Date();

        console.log("Settings loaded successfully:", state.settings);
      } else {
        console.log("No existing settings found, using defaults");
      }
    } catch (error) {
      const appError = createAppError(
        "Failed to load settings from Stream Deck",
        ErrorCodes.SYSTEM_ERROR,
        { originalError: error },
      );
      logError(appError);
      state.hasError = true;
      state.error = "Failed to load settings";
    } finally {
      state.isLoading = false;
    }
  };

  /**
   * Save settings to Stream Deck
   */
  const saveSettings = async (): Promise<void> => {
    if (!websocketService.isConnected) {
      const error = createAppError(
        "Cannot save settings: WebSocket not connected",
        ErrorCodes.WEBSOCKET_CONNECTION_FAILED,
      );
      logError(error);
      state.hasError = true;
      state.error = "Not connected to Stream Deck";
      return;
    }

    if (!state.hasChanges) {
      return; // No changes to save
    }

    state.isLoading = true;
    state.hasError = false;
    state.error = null;

    try {
      // Send settings to backend via WebSocket
      websocketService.sendSettings(state.settings);

      // Update original settings and clear change flag
      originalSettings.value = { ...state.settings };
      state.hasChanges = false;
      state.lastSaved = new Date();
    } catch (error) {
      const appError = createAppError(
        "Failed to save settings to Stream Deck",
        ErrorCodes.SYSTEM_ERROR,
        { originalError: error, settings: state.settings },
      );
      logError(appError);
      state.hasError = true;
      state.error = "Failed to save settings";
    } finally {
      state.isLoading = false;
    }
  };

  /**
   * Update a specific setting value
   */
  const updateSetting = <K extends keyof T>(key: K, value: T[K]): void => {
    (state.settings as T)[key] = value;
    checkForChanges();
  };

  /**
   * Update multiple settings at once
   */
  const updateSettings = (updates: Partial<T>): void => {
    Object.assign(state.settings, updates);
    checkForChanges();
  };

  /**
   * Reset settings to original values
   */
  const resetSettings = (): void => {
    state.settings = { ...originalSettings.value };
    state.hasChanges = false;
    state.hasError = false;
    state.error = null;
  };

  /**
   * Reset settings to defaults
   */
  const resetToDefaults = (): void => {
    Object.assign(state.settings, { ...defaultSettings });
    checkForChanges();
  };

  /**
   * Check if current settings differ from original
   */
  const checkForChanges = (): void => {
    state.hasChanges =
      JSON.stringify(state.settings) !== JSON.stringify(originalSettings.value);
  };

  /**
   * Auto-save settings when changes are detected
   */
  let saveTimeout: NodeJS.Timeout | null = null;
  const enableAutoSave = (delayMs: number = 1000): void => {
    watch(
      () => state.hasChanges,
      (hasChanges) => {
        if (hasChanges) {
          // Clear existing timeout
          if (saveTimeout) {
            clearTimeout(saveTimeout);
          }

          // Set new timeout for auto-save
          saveTimeout = setTimeout(() => {
            saveSettings();
            saveTimeout = null;
          }, delayMs);
        }
      },
      { immediate: false },
    );
  };

  /**
   * Disable auto-save
   */
  const disableAutoSave = (): void => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
  };

  /**
   * Validate settings before saving
   */
  const validateSettings = (): boolean => {
    // Basic validation - can be extended for specific setting types
    if (!state.settings) {
      state.hasError = true;
      state.error = "Settings object is required";
      return false;
    }

    // Validate API key if present
    if ("apiKey" in state.settings && state.settings.apiKey) {
      const apiKey = state.settings.apiKey as string;
      if (apiKey.length < 10) {
        state.hasError = true;
        state.error = "API key appears to be too short";
        return false;
      }
    }

    // Clear any previous validation errors
    state.hasError = false;
    state.error = null;
    return true;
  };

  /**
   * Save settings with validation
   */
  const saveWithValidation = async (): Promise<boolean> => {
    if (!validateSettings()) {
      return false;
    }

    await saveSettings();
    return !state.hasError;
  };

  /**
   * Handle incoming settings from Stream Deck
   */
  const handleIncomingSettings = (newSettings: Partial<T>): void => {
    // Merge incoming settings with current settings
    const mergedSettings = {
      ...state.settings,
      ...newSettings,
    };

    state.settings = mergedSettings;
    originalSettings.value = { ...mergedSettings };
    state.hasChanges = false;
    state.lastSaved = new Date();
  };

  /**
   * Export current settings for debugging
   */
  const exportSettings = (): string => {
    return JSON.stringify(state.settings, null, 2);
  };

  /**
   * Import settings from JSON string
   */
  const importSettings = (settingsJson: string): boolean => {
    try {
      const importedSettings = JSON.parse(settingsJson) as T;

      // Validate the imported settings structure
      const requiredKeys = Object.keys(defaultSettings);
      const importedKeys = Object.keys(importedSettings);

      const hasRequiredStructure = requiredKeys.some((key) =>
        importedKeys.includes(key),
      );

      if (!hasRequiredStructure) {
        state.hasError = true;
        state.error = "Invalid settings format";
        return false;
      }

      // Merge with defaults to ensure all properties are present
      Object.assign(state.settings, {
        ...defaultSettings,
        ...importedSettings,
      });

      checkForChanges();
      return true;
    } catch (error) {
      const appError = createAppError(
        "Failed to import settings",
        ErrorCodes.INVALID_INPUT,
        { originalError: error, settingsJson },
      );
      logError(appError);
      state.hasError = true;
      state.error = "Invalid JSON format";
      return false;
    }
  };

  // Listen for settings updates from Stream Deck
  const handleSettingsUpdate = (message: any) => {
    if (message.event === "didReceiveSettings" && message.payload?.settings) {
      handleIncomingSettings(message.payload.settings);
    }
  };

  // Initialize settings on WebSocket connection
  watch(
    () => websocketService.isConnected,
    (isConnected) => {
      if (isConnected) {
        // Listen for settings updates
        websocketService.on("didReceiveSettings", handleSettingsUpdate);

        nextTick(() => {
          // Request current settings from Stream Deck
          websocketService.requestSettings();

          // Also load from stored action info as fallback
          loadSettings();
        });
      } else {
        // Remove listener when disconnected
        websocketService.off("didReceiveSettings", handleSettingsUpdate);
      }
    },
    { immediate: true },
  );

  return {
    // State
    settings: state.settings,
    isLoading: state.isLoading,
    hasError: state.hasError,
    error: state.error,
    hasChanges: state.hasChanges,
    lastSaved: state.lastSaved,

    // Actions
    loadSettings,
    saveSettings,
    updateSetting,
    updateSettings,
    resetSettings,
    resetToDefaults,
    enableAutoSave,
    disableAutoSave,
    validateSettings,
    saveWithValidation,
    handleIncomingSettings,
    exportSettings,
    importSettings,

    // Computed
    isValid: () => !state.hasError && validateSettings(),
    isDirty: () => state.hasChanges,
    canSave: () =>
      state.hasChanges && !state.isLoading && websocketService.isConnected,
  };
}

/**
 * Specialized composable for Light Control settings
 */
export function useLightControlSettings() {
  const defaultSettings: LightControlSettings = {
    apiKey: undefined,
    selectedDeviceId: undefined,
    selectedModel: undefined,
    selectedLightName: undefined,
    controlMode: "toggle",
    brightnessValue: 100,
    colorValue: "#ffffff",
    colorTempValue: 6500,
  };

  return useSettings(defaultSettings);
}

/**
 * Specialized composable for Group Control settings
 */
export function useGroupControlSettings() {
  const defaultSettings: GroupControlSettings = {
    apiKey: undefined,
    selectedGroupId: undefined,
    selectedGroupName: undefined,
    controlMode: "toggle",
    brightnessValue: 100,
    colorValue: "#ffffff",
    colorTempValue: 6500,
  };

  return useSettings(defaultSettings);
}

/**
 * Specialized composable for Scene Control settings
 */
export function useSceneControlSettings() {
  const defaultSettings: SceneControlSettings = {
    apiKey: undefined,
    selectedDeviceId: undefined,
    selectedModel: undefined,
    selectedLightName: undefined,
    selectedSceneId: undefined,
    selectedSceneName: undefined,
  };

  return useSettings(defaultSettings);
}

/**
 * Specialized composable for Music Mode settings
 */
export function useMusicModeSettings() {
  const defaultSettings: MusicModeSettings = {
    apiKey: undefined,
    selectedDeviceId: undefined,
    selectedModel: undefined,
    selectedLightName: undefined,
    musicMode: undefined,
    sensitivity: 50,
    autoColor: true,
  };

  return useSettings(defaultSettings);
}

/**
 * Specialized composable for Segment Color Dial settings
 */
export function useSegmentColorDialSettings() {
  const defaultSettings: SegmentColorDialSettings = {
    apiKey: undefined,
    selectedDeviceId: undefined,
    selectedModel: undefined,
    selectedLightName: undefined,
    segmentIndex: 0,
    hue: 0,
    saturation: 100,
    brightness: 100,
    stepSize: 15,
  };

  return useSettings(defaultSettings);
}
