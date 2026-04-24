import { Brightness } from "./Brightness";
import { ColorRgb } from "./ColorRgb";
import { ColorTemperature } from "./ColorTemperature";

export interface LightState {
  isOn: boolean;
  brightness?: Brightness;
  color?: ColorRgb;
  colorTemperature?: ColorTemperature;
  isOnline: boolean;
}
