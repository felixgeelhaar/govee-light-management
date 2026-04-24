import {
  Brightness as ApiBrightness,
  ColorRgb as ApiColorRgb,
  ColorTemperature as ApiColorTemperature,
} from "@felixgeelhaar/govee-api-client";
import { Brightness } from "../../domain/value-objects/Brightness";
import { ColorRgb } from "../../domain/value-objects/ColorRgb";
import { ColorTemperature } from "../../domain/value-objects/ColorTemperature";

export class LightValueMapper {
  static toDomainBrightness(brightness: ApiBrightness): Brightness {
    return new Brightness(brightness.level);
  }

  static toApiBrightness(brightness: Brightness): ApiBrightness {
    return new ApiBrightness(brightness.level);
  }

  static toDomainColor(color: ApiColorRgb): ColorRgb {
    return new ColorRgb(color.r, color.g, color.b);
  }

  static toApiColor(color: ColorRgb): ApiColorRgb {
    return new ApiColorRgb(color.r, color.g, color.b);
  }

  static toDomainColorTemperature(
    colorTemperature: ApiColorTemperature,
  ): ColorTemperature {
    return new ColorTemperature(colorTemperature.kelvin);
  }

  static toApiColorTemperature(
    colorTemperature: ColorTemperature,
  ): ApiColorTemperature {
    return new ApiColorTemperature(colorTemperature.kelvin);
  }
}
