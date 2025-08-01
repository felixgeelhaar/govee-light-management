import { z } from "zod";

/**
 * Zod schemas for validating Govee API responses
 * Provides runtime type safety and clear error messages
 */

// Base device schema matching Govee API structure
export const GoveeDeviceSchema = z.object({
  deviceId: z.string().min(1, "Device ID cannot be empty"),
  model: z.string().min(1, "Model cannot be empty"),
  deviceName: z.string().min(1, "Device name cannot be empty"),
  canControl: z.any().optional(), // Function from Govee API client
});

// Device list response schema
export const GoveeDeviceListSchema = z.object({
  devices: z.array(GoveeDeviceSchema),
  total: z.number().optional(),
});

// Device state schema for individual device status
export const GoveeDeviceStateSchema = z.object({
  getPowerState: z.any(), // Function returning 'on' | 'off'
  isOnline: z.any(), // Function returning boolean
  getBrightness: z.any().optional(), // Function returning brightness object
  getColor: z.any().optional(), // Function returning color object
  getColorTemperature: z.any().optional(), // Function returning color temp object
});

// API error response schema
export const GoveeApiErrorSchema = z.object({
  error: z.object({
    code: z.number(),
    message: z.string(),
  }),
});

// Generic API response wrapper
export const GoveeApiResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.any().optional(),
});

// Settings validation schemas for Stream Deck
export const LightControlSettingsSchema = z.object({
  apiKey: z.string().optional(),
  selectedDeviceId: z.string().optional(),
  selectedModel: z.string().optional(),
  selectedLightName: z.string().optional(),
  controlMode: z.enum(["toggle", "on", "off", "brightness", "color", "colorTemp"]).optional(),
  brightnessValue: z.number().min(0).max(100).optional(),
  colorValue: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  colorTempValue: z.number().min(2000).max(9000).optional(),
});

export const GroupControlSettingsSchema = z.object({
  apiKey: z.string().optional(),
  selectedGroupId: z.string().optional(),
  selectedGroupName: z.string().optional(),
  controlMode: z.enum(["toggle", "on", "off", "brightness", "color", "colorTemp"]).optional(),
  brightnessValue: z.number().min(0).max(100).optional(),
  colorValue: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  colorTempValue: z.number().min(2000).max(9000).optional(),
});

// Type exports for use in other files
export type GoveeDevice = z.infer<typeof GoveeDeviceSchema>;
export type GoveeDeviceList = z.infer<typeof GoveeDeviceListSchema>;
export type GoveeDeviceState = z.infer<typeof GoveeDeviceStateSchema>;
export type GoveeApiError = z.infer<typeof GoveeApiErrorSchema>;
export type GoveeApiResponse = z.infer<typeof GoveeApiResponseSchema>;
export type LightControlSettings = z.infer<typeof LightControlSettingsSchema>;
export type GroupControlSettings = z.infer<typeof GroupControlSettingsSchema>;