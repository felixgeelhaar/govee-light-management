/**
 * Background light state monitoring service
 * Tracks light states, detects changes, and provides synchronization capabilities
 */

import { ref, computed } from "vue";
import { websocketService } from "./websocketService";
import { apiCacheService } from "./cacheService";
import { performanceService } from "./performanceService";
import { recoveryService } from "./recoveryService";
import { createAppError, ErrorCodes } from "../utils/errorHandling";

export interface LightState {
  deviceId: string;
  model: string;
  name: string;
  isOnline: boolean;
  powerState: boolean;
  brightness?: number;
  color?: {
    r: number;
    g: number;
    b: number;
  };
  colorTemperature?: number;
  lastUpdated: number;
  lastSeen: number;
}

export interface LightStateChange {
  deviceId: string;
  property: keyof LightState;
  oldValue: any;
  newValue: any;
  timestamp: number;
}

export interface MonitoringConfig {
  pollInterval: number; // milliseconds
  timeoutThreshold: number; // milliseconds for considering a light offline
  maxRetries: number;
  enableChangeDetection: boolean;
  enableAutoSync: boolean;
}

/**
 * Background light state monitoring service
 */
export class LightMonitoringService {
  private lightStates = new Map<string, LightState>();
  private monitoredLights = new Set<string>();
  private changeHistory: LightStateChange[] = [];
  private changeCallbacks = new Map<
    string,
    ((change: LightStateChange) => void)[]
  >();

  // Monitoring state
  private isMonitoring = ref(false);
  private lastPollTime = ref<number | null>(null);
  private pollCount = ref(0);
  private errorCount = ref(0);

  // Configuration
  private config: MonitoringConfig = {
    pollInterval: 30000, // 30 seconds
    timeoutThreshold: 60000, // 1 minute offline threshold
    maxRetries: 3,
    enableChangeDetection: true,
    enableAutoSync: true,
  };

  // Polling management
  private pollTimer: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor() {
    // Initialize reactive state
    this.setupReactiveState();
  }

  /**
   * Start monitoring specified lights
   */
  async startMonitoring(
    lightIds: string[],
    config?: Partial<MonitoringConfig>,
  ): Promise<void> {
    if (this.isMonitoring.value) {
      console.log("Light monitoring already active");
      return;
    }

    // Update configuration
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Add lights to monitoring set
    lightIds.forEach((id) => this.monitoredLights.add(id));

    // Perform initial state sync
    await this.syncLightStates();

    // Start background polling
    this.startPolling();

    this.isMonitoring.value = true;
    console.log(`Started monitoring ${lightIds.length} lights`);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring.value) {
      return;
    }

    this.stopPolling();
    this.isMonitoring.value = false;
    console.log("Stopped light monitoring");
  }

  /**
   * Add lights to monitoring
   */
  addLights(lightIds: string[]): void {
    lightIds.forEach((id) => this.monitoredLights.add(id));

    if (this.isMonitoring.value) {
      // Sync new lights immediately
      this.syncSpecificLights(lightIds);
    }
  }

  /**
   * Remove lights from monitoring
   */
  removeLights(lightIds: string[]): void {
    lightIds.forEach((id) => {
      this.monitoredLights.delete(id);
      this.lightStates.delete(id);
    });
  }

  /**
   * Get current state of a light
   */
  getLightState(deviceId: string): LightState | null {
    return this.lightStates.get(deviceId) || null;
  }

  /**
   * Get all monitored light states
   */
  getAllLightStates(): Record<string, LightState> {
    const states: Record<string, LightState> = {};
    this.lightStates.forEach((state, deviceId) => {
      states[deviceId] = { ...state };
    });
    return states;
  }

  /**
   * Get lights that appear to be offline
   */
  getOfflineLights(): LightState[] {
    const now = Date.now();
    const threshold = this.config.timeoutThreshold;

    return Array.from(this.lightStates.values()).filter(
      (state) => !state.isOnline || now - state.lastSeen > threshold,
    );
  }

  /**
   * Get recent state changes
   */
  getRecentChanges(sinceTimestamp?: number): LightStateChange[] {
    const since = sinceTimestamp || Date.now() - 300000; // Last 5 minutes
    return this.changeHistory.filter((change) => change.timestamp >= since);
  }

  /**
   * Subscribe to state changes for specific lights
   */
  onStateChange(
    deviceId: string,
    callback: (change: LightStateChange) => void,
  ): () => void {
    if (!this.changeCallbacks.has(deviceId)) {
      this.changeCallbacks.set(deviceId, []);
    }
    this.changeCallbacks.get(deviceId)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.changeCallbacks.get(deviceId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Force immediate state sync for all monitored lights
   */
  async syncLightStates(): Promise<void> {
    if (this.monitoredLights.size === 0) {
      return;
    }

    const lightIds = Array.from(this.monitoredLights);
    await this.syncSpecificLights(lightIds);
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): {
    isActive: boolean;
    monitoredCount: number;
    onlineCount: number;
    offlineCount: number;
    lastPollTime: number | null;
    pollCount: number;
    errorCount: number;
    changeCount: number;
  } {
    const states = Array.from(this.lightStates.values());
    const onlineCount = states.filter((s) => s.isOnline).length;
    const offlineCount = states.length - onlineCount;

    return {
      isActive: this.isMonitoring.value,
      monitoredCount: this.monitoredLights.size,
      onlineCount,
      offlineCount,
      lastPollTime: this.lastPollTime.value,
      pollCount: this.pollCount.value,
      errorCount: this.errorCount.value,
      changeCount: this.changeHistory.length,
    };
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Restart polling if interval changed
    if (newConfig.pollInterval && this.isMonitoring.value) {
      this.stopPolling();
      this.startPolling();
    }
  }

  /**
   * Clear monitoring history and reset state
   */
  reset(): void {
    this.stopMonitoring();
    this.lightStates.clear();
    this.monitoredLights.clear();
    this.changeHistory = [];
    this.changeCallbacks.clear();
    this.pollCount.value = 0;
    this.errorCount.value = 0;
    this.lastPollTime.value = null;
  }

  /**
   * Private methods
   */
  private setupReactiveState(): void {
    // Additional reactive computed properties can be added here
  }

  private startPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    this.pollTimer = setInterval(async () => {
      if (this.isPolling) {
        return; // Skip if already polling
      }

      try {
        this.isPolling = true;
        await this.performPoll();
        this.pollCount.value++;
        this.lastPollTime.value = Date.now();
      } catch (error) {
        this.errorCount.value++;
        console.error("Light monitoring poll failed:", error);

        // Attempt recovery if too many errors
        if (this.errorCount.value >= this.config.maxRetries) {
          await recoveryService.attemptRecovery(error as Error, {
            operation: "light-monitoring",
            monitoredLights: Array.from(this.monitoredLights),
          });
        }
      } finally {
        this.isPolling = false;
      }
    }, this.config.pollInterval);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isPolling = false;
  }

  private async performPoll(): Promise<void> {
    const operationId = `light-monitoring-poll-${Date.now()}`;

    await performanceService.timeAsync(
      operationId,
      "Light State Poll",
      async () => {
        const lightIds = Array.from(this.monitoredLights);

        // Check WebSocket connection
        if (!websocketService.isConnected) {
          throw createAppError(
            "WebSocket not connected for light monitoring",
            ErrorCodes.WEBSOCKET_CONNECTION_FAILED,
          );
        }

        // Request current states for all monitored lights
        await this.syncSpecificLights(lightIds);
      },
    );
  }

  private async syncSpecificLights(lightIds: string[]): Promise<void> {
    if (lightIds.length === 0) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        websocketService.off("sendToPropertyInspector", responseHandler);
        reject(new Error("Light state sync timeout"));
      }, 10000); // 10 second timeout

      const responseHandler = (message: any) => {
        if (message.payload?.event === "lightStatesReceived") {
          clearTimeout(timeout);
          websocketService.off("sendToPropertyInspector", responseHandler);

          if (message.payload.error) {
            reject(new Error(message.payload.error));
          } else {
            const states = message.payload.states || [];
            this.updateLightStates(states);
            resolve();
          }
        }
      };

      // Listen for response
      websocketService.on("sendToPropertyInspector", responseHandler);

      // Request light states
      websocketService.sendMessage({
        event: "sendToPlugin",
        context: websocketService.getActionInfo?.context || "",
        payload: {
          event: "getLightStates",
          deviceIds: lightIds,
        },
      });
    });
  }

  private updateLightStates(states: any[]): void {
    const now = Date.now();

    states.forEach((stateData: any) => {
      const deviceId = stateData.deviceId;
      if (!deviceId || !this.monitoredLights.has(deviceId)) {
        return;
      }

      const existingState = this.lightStates.get(deviceId);
      const newState: LightState = {
        deviceId,
        model: stateData.model || existingState?.model || "unknown",
        name: stateData.name || existingState?.name || deviceId,
        isOnline: stateData.isOnline !== false,
        powerState: stateData.powerState === true,
        brightness: stateData.brightness,
        color: stateData.color,
        colorTemperature: stateData.colorTemperature,
        lastUpdated: now,
        lastSeen:
          stateData.isOnline !== false ? now : existingState?.lastSeen || now,
      };

      // Detect and record changes
      if (existingState && this.config.enableChangeDetection) {
        this.detectAndRecordChanges(existingState, newState);
      }

      // Update state
      this.lightStates.set(deviceId, newState);

      // Cache the state
      apiCacheService.set(`light-state-${deviceId}`, newState, 300000); // 5 minute cache
    });
  }

  private detectAndRecordChanges(
    oldState: LightState,
    newState: LightState,
  ): void {
    const properties: (keyof LightState)[] = [
      "isOnline",
      "powerState",
      "brightness",
      "color",
      "colorTemperature",
    ];

    properties.forEach((property) => {
      const oldValue = oldState[property];
      const newValue = newState[property];

      // Deep comparison for complex objects
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        const change: LightStateChange = {
          deviceId: newState.deviceId,
          property,
          oldValue,
          newValue,
          timestamp: Date.now(),
        };

        this.changeHistory.push(change);

        // Keep only last 1000 changes
        if (this.changeHistory.length > 1000) {
          this.changeHistory = this.changeHistory.slice(-1000);
        }

        // Notify subscribers
        const callbacks = this.changeCallbacks.get(newState.deviceId);
        if (callbacks) {
          callbacks.forEach((callback) => callback(change));
        }
      }
    });
  }
}

/**
 * Singleton instance
 */
export const lightMonitoringService = new LightMonitoringService();

/**
 * Vue composable for light monitoring
 */
export function useLightMonitoring() {
  return {
    // State
    isMonitoring: computed(
      () => lightMonitoringService.getMonitoringStats().isActive,
    ),
    monitoringStats: computed(() =>
      lightMonitoringService.getMonitoringStats(),
    ),

    // Actions
    startMonitoring: (lightIds: string[], config?: Partial<MonitoringConfig>) =>
      lightMonitoringService.startMonitoring(lightIds, config),
    stopMonitoring: () => lightMonitoringService.stopMonitoring(),
    addLights: (lightIds: string[]) =>
      lightMonitoringService.addLights(lightIds),
    removeLights: (lightIds: string[]) =>
      lightMonitoringService.removeLights(lightIds),

    // Data access
    getLightState: (deviceId: string) =>
      lightMonitoringService.getLightState(deviceId),
    getAllLightStates: () => lightMonitoringService.getAllLightStates(),
    getOfflineLights: () => lightMonitoringService.getOfflineLights(),
    getRecentChanges: (since?: number) =>
      lightMonitoringService.getRecentChanges(since),

    // Events
    onStateChange: (
      deviceId: string,
      callback: (change: LightStateChange) => void,
    ) => lightMonitoringService.onStateChange(deviceId, callback),

    // Utilities
    syncLightStates: () => lightMonitoringService.syncLightStates(),
    updateConfig: (config: Partial<MonitoringConfig>) =>
      lightMonitoringService.updateConfig(config),
    reset: () => lightMonitoringService.reset(),
  };
}
