/**
 * Base classes and utilities for Stream Deck actions
 * Provides standardized patterns for all action implementations
 */

export { AbstractStreamDeckAction } from "./AbstractStreamDeckAction";
export { ActionValidationService } from "./ActionValidationService";
export { ActionErrorHandler } from "./ActionErrorHandler";
export type { ErrorContext } from "./ActionErrorHandler";

export type {
  BaseActionSettings,
  TargetType,
  ActionTarget,
  ActionState,
  ValidationResult,
} from "./BaseActionSettings";