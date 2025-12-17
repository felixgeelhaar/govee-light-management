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
  canControl: z.function().optional(), // Function from Govee API client
});

// Device list response schema
export const GoveeDeviceListSchema = z.object({
  devices: z.array(GoveeDeviceSchema),
  total: z.number().optional(),
});

// Device state schema for individual device status
export const GoveeDeviceStateSchema = z.object({
  getPowerState: z.function(), // Function returning 'on' | 'off'
  isOnline: z.function(), // Function returning boolean
  getBrightness: z.function().optional(), // Function returning brightness object
  getColor: z.function().optional(), // Function returning color object
  getColorTemperature: z.function().optional(), // Function returning color temp object
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
  data: z.unknown().optional(),
});

// Control mode enum
const ControlModeSchema = z.enum([
  "toggle",
  "on",
  "off",
  "brightness",
  "color",
  "colorTemp",
  "nightlight-on",
  "nightlight-off",
  "gradient-on",
  "gradient-off",
]);

// Base settings shared by all action types
const BaseActionSettingsSchema = z.object({
  apiKey: z.string().optional(),
  controlMode: ControlModeSchema.optional(),
  brightnessValue: z.number().min(1).max(100).optional(),
  colorValue: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color (e.g., #FF0000)")
    .optional(),
  colorTempValue: z.number().min(2000).max(9000).optional(),
});

// Settings validation schemas for Stream Deck
export const LightControlSettingsSchema = BaseActionSettingsSchema.extend({
  selectedDeviceId: z.string().optional(),
  selectedModel: z.string().optional(),
  selectedLightName: z.string().optional(),
});

export const GroupControlSettingsSchema = BaseActionSettingsSchema.extend({
  selectedGroupId: z.string().optional(),
  selectedGroupName: z.string().optional(),
});

export const SceneControlSettingsSchema = BaseActionSettingsSchema.extend({
  selectedDeviceId: z.string().optional(),
  selectedModel: z.string().optional(),
  selectedLightName: z.string().optional(),
  selectedSceneId: z.string().optional(),
  selectedSceneName: z.string().optional(),
});

export const MusicModeSettingsSchema = BaseActionSettingsSchema.extend({
  selectedDeviceId: z.string().optional(),
  selectedModel: z.string().optional(),
  selectedLightName: z.string().optional(),
  musicMode: z.string().optional(),
  sensitivity: z.number().min(0).max(100).optional(),
  autoColor: z.boolean().optional(),
});

export const SegmentColorDialSettingsSchema = BaseActionSettingsSchema.extend({
  selectedDeviceId: z.string().optional(),
  selectedModel: z.string().optional(),
  selectedLightName: z.string().optional(),
  segmentIndex: z.number().min(0).max(14).optional(),
  hue: z.number().min(0).max(360).optional(),
  saturation: z.number().min(0).max(100).optional(),
  brightness: z.number().min(0).max(100).optional(),
  stepSize: z.number().min(1).max(90).optional(),
});

export const BrightnessDialSettingsSchema = BaseActionSettingsSchema.extend({
  selectedDeviceId: z.string().optional(),
  selectedModel: z.string().optional(),
  selectedLightName: z.string().optional(),
  stepSize: z.number().min(1).max(25).optional(),
});

export const ColorTempDialSettingsSchema = BaseActionSettingsSchema.extend({
  selectedDeviceId: z.string().optional(),
  selectedModel: z.string().optional(),
  selectedLightName: z.string().optional(),
  stepSize: z.number().min(50).max(500).optional(),
});

export const ColorHueDialSettingsSchema = BaseActionSettingsSchema.extend({
  selectedDeviceId: z.string().optional(),
  selectedModel: z.string().optional(),
  selectedLightName: z.string().optional(),
  saturation: z.number().min(0).max(100).optional(),
  stepSize: z.number().min(1).max(90).optional(),
});

// Type exports for use in other files
export type GoveeDevice = z.infer<typeof GoveeDeviceSchema>;
export type GoveeDeviceList = z.infer<typeof GoveeDeviceListSchema>;
export type GoveeDeviceState = z.infer<typeof GoveeDeviceStateSchema>;
export type GoveeApiError = z.infer<typeof GoveeApiErrorSchema>;
export type GoveeApiResponse = z.infer<typeof GoveeApiResponseSchema>;
export type LightControlSettings = z.infer<typeof LightControlSettingsSchema>;
export type GroupControlSettings = z.infer<typeof GroupControlSettingsSchema>;
export type SceneControlSettings = z.infer<typeof SceneControlSettingsSchema>;
export type MusicModeSettings = z.infer<typeof MusicModeSettingsSchema>;
export type SegmentColorDialSettings = z.infer<
  typeof SegmentColorDialSettingsSchema
>;
export type BrightnessDialSettings = z.infer<
  typeof BrightnessDialSettingsSchema
>;
export type ColorTempDialSettings = z.infer<typeof ColorTempDialSettingsSchema>;
export type ColorHueDialSettings = z.infer<typeof ColorHueDialSettingsSchema>;
