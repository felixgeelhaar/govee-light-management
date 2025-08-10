import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActionValidationService } from "../../../../src/backend/actions/base/ActionValidationService";
import type { BaseActionSettings } from "../../../../src/backend/actions/base/BaseActionSettings";

// Mock the Govee API client
vi.mock("@felixgeelhaar/govee-api-client", () => ({
  GoveeApiClient: vi.fn().mockImplementation(() => ({
    getDevices: vi.fn().mockResolvedValue([
      { deviceId: "test-device", model: "H6159", name: "Test Light" }
    ])
  }))
}));

describe("ActionValidationService", () => {
  describe("validateTarget", () => {
    it("should validate light target successfully", () => {
      const settings: BaseActionSettings = {
        targetType: "light",
        lightId: "test-light",
        lightModel: "H6159"
      };
      
      const result = ActionValidationService.validateTarget(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it("should fail validation for missing light ID", () => {
      const settings: BaseActionSettings = {
        targetType: "light",
        lightModel: "H6159"
      };
      
      const result = ActionValidationService.validateTarget(settings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("No light device selected");
    });
    
    it("should warn about missing light model", () => {
      const settings: BaseActionSettings = {
        targetType: "light",
        lightId: "test-light"
      };
      
      const result = ActionValidationService.validateTarget(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("Light model not specified");
    });
    
    it("should validate group target successfully", () => {
      const settings: BaseActionSettings = {
        targetType: "group",
        groupId: "test-group"
      };
      
      const result = ActionValidationService.validateTarget(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it("should fail validation for missing group ID", () => {
      const settings: BaseActionSettings = {
        targetType: "group"
      };
      
      const result = ActionValidationService.validateTarget(settings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("No group selected");
    });
    
    it("should fail validation for missing target type", () => {
      const settings: BaseActionSettings = {};
      
      const result = ActionValidationService.validateTarget(settings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("No target type selected");
    });
    
    it("should fail validation for invalid target type", () => {
      const settings: BaseActionSettings = {
        targetType: "invalid" as any
      };
      
      const result = ActionValidationService.validateTarget(settings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("Invalid target type");
    });
  });
  
  describe("validateBrightness", () => {
    it("should validate valid brightness value", () => {
      const result = ActionValidationService.validateBrightness(50);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it("should validate boundary values", () => {
      expect(ActionValidationService.validateBrightness(0).isValid).toBe(true);
      expect(ActionValidationService.validateBrightness(100).isValid).toBe(true);
    });
    
    it("should fail for out of range values", () => {
      const result = ActionValidationService.validateBrightness(150);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("must be between 0 and 100");
    });
    
    it("should fail for negative values", () => {
      const result = ActionValidationService.validateBrightness(-10);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("must be between 0 and 100");
    });
    
    it("should fail for non-numeric values", () => {
      const result = ActionValidationService.validateBrightness(NaN);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("must be a number");
    });
    
    it("should respect custom min/max values", () => {
      const result = ActionValidationService.validateBrightness(75, 0, 50);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("must be between 0 and 50");
    });
  });
  
  describe("validateColorTemperature", () => {
    it("should validate valid temperature", () => {
      const result = ActionValidationService.validateColorTemperature(5000);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it("should validate boundary values", () => {
      expect(ActionValidationService.validateColorTemperature(2000).isValid).toBe(true);
      expect(ActionValidationService.validateColorTemperature(9000).isValid).toBe(true);
    });
    
    it("should fail for out of range values", () => {
      const result = ActionValidationService.validateColorTemperature(10000);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("must be between 2000K and 9000K");
    });
    
    it("should fail for too low values", () => {
      const result = ActionValidationService.validateColorTemperature(1500);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("must be between 2000K and 9000K");
    });
  });
  
  describe("validateColor", () => {
    it("should validate valid hex color", () => {
      const result = ActionValidationService.validateColor("#FF5733");
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it("should validate lowercase hex", () => {
      const result = ActionValidationService.validateColor("#aabbcc");
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it("should fail for invalid hex format", () => {
      const result = ActionValidationService.validateColor("#GG5733");
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("must be in format #RRGGBB");
    });
    
    it("should fail for missing hash", () => {
      const result = ActionValidationService.validateColor("FF5733");
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("must be in format #RRGGBB");
    });
    
    it("should fail for wrong length", () => {
      const result = ActionValidationService.validateColor("#FFF");
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("must be in format #RRGGBB");
    });
    
    it("should fail for null or empty", () => {
      const result = ActionValidationService.validateColor("");
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("must be a valid hex string");
    });
  });
  
  describe("validateStepSize", () => {
    it("should validate valid step size", () => {
      const result = ActionValidationService.validateStepSize(10);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it("should validate boundary values", () => {
      expect(ActionValidationService.validateStepSize(1).isValid).toBe(true);
      expect(ActionValidationService.validateStepSize(50).isValid).toBe(true);
    });
    
    it("should fail for decimal values", () => {
      const result = ActionValidationService.validateStepSize(5.5);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("must be a whole number");
    });
    
    it("should fail for out of range values", () => {
      const result = ActionValidationService.validateStepSize(100);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("must be between 1 and 50");
    });
    
    it("should respect custom ranges", () => {
      const result = ActionValidationService.validateStepSize(15, 1, 10);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("must be between 1 and 10");
    });
  });
  
  describe("validateApiKeyFormat", () => {
    it("should validate valid API key format", () => {
      const result = ActionValidationService.validateApiKeyFormat("abc123-def456-ghi789");
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it("should fail for empty API key", () => {
      const result = ActionValidationService.validateApiKeyFormat("");
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("API key is required");
    });
    
    it("should fail for too short API key", () => {
      const result = ActionValidationService.validateApiKeyFormat("short");
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("API key appears to be too short");
    });
    
    it("should warn about whitespace", () => {
      const result = ActionValidationService.validateApiKeyFormat("  valid-api-key  ");
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("API key contains whitespace");
    });
    
    it("should warn about unusual characters", () => {
      const result = ActionValidationService.validateApiKeyFormat("api@key#special$");
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("API key contains unusual characters");
    });
  });
  
  describe("validateApiKey", () => {
    it("should validate API key successfully", async () => {
      const result = await ActionValidationService.validateApiKey("valid-api-key-123");
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it("should fail for invalid format", async () => {
      const result = await ActionValidationService.validateApiKey("");
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("API key is required");
    });
    
    it("should warn when no devices found", async () => {
      vi.mocked(vi.fn()).mockResolvedValueOnce([]);
      
      const { GoveeApiClient } = await import("@felixgeelhaar/govee-api-client");
      vi.mocked(GoveeApiClient).mockImplementationOnce(() => ({
        getDevices: vi.fn().mockResolvedValueOnce([])
      } as any));
      
      const result = await ActionValidationService.validateApiKey("valid-but-no-devices");
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("No devices found on account");
    });
  });
  
  describe("validateSettings", () => {
    it("should validate complete valid settings", () => {
      const settings: BaseActionSettings = {
        apiKey: "valid-api-key-123",
        targetType: "light",
        lightId: "test-light",
        lightModel: "H6159"
      };
      
      const result = ActionValidationService.validateSettings(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it("should collect all validation errors", () => {
      const settings: BaseActionSettings = {
        // Missing API key
        targetType: "light"
        // Missing light ID
      };
      
      const result = ActionValidationService.validateSettings(settings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("API key is required");
      expect(result.errors).toContain("No light device selected");
    });
    
    it("should include warnings", () => {
      const settings: BaseActionSettings = {
        apiKey: "  valid-key-with-spaces  ",
        targetType: "light",
        lightId: "test-light"
        // Missing model (warning)
      };
      
      const result = ActionValidationService.validateSettings(settings);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain("API key contains whitespace");
      expect(result.warnings).toContain("Light model not specified");
    });
  });
  
  describe("validateDeviceCapability", () => {
    it("should validate device has required capability", () => {
      const capabilities = ["onOff", "brightness", "color", "colorTem"];
      
      const result = ActionValidationService.validateDeviceCapability(capabilities, "color");
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it("should fail when capability is missing", () => {
      const capabilities = ["onOff", "brightness"];
      
      const result = ActionValidationService.validateDeviceCapability(capabilities, "color");
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("Device does not support color control");
    });
    
    it("should handle colorTem capability", () => {
      const capabilities = ["onOff", "brightness"];
      
      const result = ActionValidationService.validateDeviceCapability(capabilities, "colorTem");
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("Device does not support color temperature");
    });
    
    it("should handle brightness capability", () => {
      const capabilities = ["onOff"];
      
      const result = ActionValidationService.validateDeviceCapability(capabilities, "brightness");
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("Device does not support brightness control");
    });
    
    it("should fail for invalid capabilities array", () => {
      const result = ActionValidationService.validateDeviceCapability(null as any, "color");
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain("Device capabilities not available");
    });
  });
});