import {
  ColorRgb,
  ColorTemperature,
  Brightness,
} from "@felixgeelhaar/govee-api-client";

export interface LightState {
  isOn: boolean;
  brightness?: Brightness;
  color?: ColorRgb;
  colorTemperature?: ColorTemperature;
  isOnline: boolean;
}
