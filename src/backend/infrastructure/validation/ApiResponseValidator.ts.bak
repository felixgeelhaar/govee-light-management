import { z } from "zod";
import streamDeck from "@elgato/streamdeck";

/**
 * API Response Validator using Zod
 * Provides runtime validation with detailed error reporting
 */
export class ApiResponseValidator {
  /**
   * Validates data against a Zod schema with enhanced error reporting
   */
  static validate<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    context: string,
  ): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorDetails = error.issues
          .map((err) => `${err.path.join(".")} - ${err.message}`)
          .join("; ");

        streamDeck.logger.error(`Validation failed in ${context}:`, {
          errors: error.issues,
          data: JSON.stringify(data, null, 2),
        });

        throw new ApiValidationError(
          `Invalid ${context}: ${errorDetails}`,
          error.issues,
          data,
        );
      }

      streamDeck.logger.error(
        `Unexpected validation error in ${context}:`,
        error,
      );
      throw new ApiValidationError(
        `Validation failed for ${context}: ${error instanceof Error ? error.message : "Unknown error"}`,
        [],
        data,
      );
    }
  }

  /**
   * Safely validates data, returning null if validation fails
   */
  static safeParse<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    context: string,
  ): T | null {
    try {
      return this.validate(schema, data, context);
    } catch (error) {
      streamDeck.logger.warn(
        `Safe validation failed in ${context}, returning null:`,
        error,
      );
      return null;
    }
  }

  /**
   * Validates an array of items, filtering out invalid ones
   */
  static validateArray<T>(
    itemSchema: z.ZodSchema<T>,
    data: unknown[],
    context: string,
  ): T[] {
    const validItems: T[] = [];
    const errors: string[] = [];

    data.forEach((item, index) => {
      try {
        const validItem = this.validate(
          itemSchema,
          item,
          `${context}[${index}]`,
        );
        validItems.push(validItem);
      } catch (error) {
        errors.push(
          `Item ${index}: ${error instanceof Error ? error.message : "Validation failed"}`,
        );
      }
    });

    if (errors.length > 0) {
      streamDeck.logger.warn(
        `Some items failed validation in ${context}:`,
        errors,
      );
    }

    return validItems;
  }
}

/**
 * Custom error class for API validation failures
 */
export class ApiValidationError extends Error {
  constructor(
    message: string,
    public readonly zodErrors: z.ZodIssue[],
    public readonly invalidData: unknown,
  ) {
    super(message);
    this.name = "ApiValidationError";
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(): string {
    if (this.zodErrors.length === 0) {
      return "Invalid data received from API";
    }

    const mainError = this.zodErrors[0];
    const fieldPath =
      mainError.path.length > 0 ? mainError.path.join(".") : "data";

    switch (mainError.code) {
      case "invalid_type":
        return `Invalid type for ${fieldPath}: ${mainError.message}`;
      case "too_small":
        return `Value too small for ${fieldPath}: ${mainError.message}`;
      case "too_big":
        return `Value too large for ${fieldPath}: ${mainError.message}`;
      case "invalid_format":
        return `Invalid format for ${fieldPath}: ${mainError.message}`;
      default:
        return `Validation error for ${fieldPath}: ${mainError.message}`;
    }
  }
}
