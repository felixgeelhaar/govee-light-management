/**
 * SegmentColorMapper - Maps domain SegmentColor to govee-api-client SegmentColor
 *
 * Handles conversion between domain layer segment color (segmentIndex property)
 * and Govee API SegmentColor (index property).
 */

import { ColorRgb, Brightness, SegmentColor as ApiSegmentColor } from '@felixgeelhaar/govee-api-client';
import { SegmentColor as DomainSegmentColor } from '../../domain/value-objects/SegmentColor';

/**
 * Maps domain SegmentColor to govee-api-client SegmentColor
 *
 * @param segment - Domain segment color value object
 * @returns SegmentColor instance for Govee API
 *
 * @example
 * const domainSegment = SegmentColor.create(0, ColorRgb.fromHex('#FF0000'));
 * const apiSegment = SegmentColorMapper.toApiSegmentColor(domainSegment);
 * // Returns: SegmentColor with index=0, color=RGB(255,0,0)
 */
export class SegmentColorMapper {
  /**
   * Convert domain SegmentColor to API SegmentColor
   *
   * The domain uses 'segmentIndex' while the API uses 'index'.
   * Both use the same ColorRgb type, which can be passed directly.
   *
   * Note: The API SegmentColor supports optional per-segment brightness,
   * which is not currently exposed in the domain layer. This could be
   * a future enhancement.
   */
  static toApiSegmentColor(segment: DomainSegmentColor): ApiSegmentColor {
    // The ColorRgb type is shared between domain and API, so we can pass it directly
    return new ApiSegmentColor(
      segment.segmentIndex,
      segment.color,
      undefined // brightness not supported in domain layer yet
    );
  }

  /**
   * Convert multiple domain SegmentColors to API SegmentColors
   *
   * @param segments - Array of domain segment colors
   * @returns Array of API segment colors
   */
  static toApiSegmentColors(segments: DomainSegmentColor[]): ApiSegmentColor[] {
    return segments.map((segment) => this.toApiSegmentColor(segment));
  }

  /**
   * Convert API SegmentColor back to domain SegmentColor
   *
   * Useful for reading current state from API responses.
   *
   * @param apiSegment - API segment color
   * @returns Domain segment color value object
   */
  static toDomainSegmentColor(apiSegment: ApiSegmentColor): DomainSegmentColor {
    return DomainSegmentColor.create(apiSegment.index, apiSegment.color);
  }

  /**
   * Convert multiple API SegmentColors to domain SegmentColors
   *
   * @param apiSegments - Array of API segment colors
   * @returns Array of domain segment colors
   */
  static toDomainSegmentColors(apiSegments: ApiSegmentColor[]): DomainSegmentColor[] {
    return apiSegments.map((segment) => this.toDomainSegmentColor(segment));
  }
}
