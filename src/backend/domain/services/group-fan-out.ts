import type { Light } from "../entities/Light";

/** A light the operation could not be applied to, and why. */
export interface FailedLight {
  light: Light;
  error: unknown;
}

/** How one operation fared across the lights it was sent to. */
export interface FanOutOutcome {
  total: number;
  failed: FailedLight[];
}

/**
 * Apply one operation to every light at once and wait for all of them.
 *
 * Every request leaves before any answers, so members of a group change
 * together instead of one after another. Results are settled rather than
 * raced: one unreachable lamp must not discard the work that succeeded on
 * the rest, so a partial failure resolves and names the lights that
 * failed. Only a total failure — including having nothing to send to —
 * rejects, with the first member's error so callers can still classify it
 * (validation, rate limit, out of range).
 */
export async function fanOutToLights(
  lights: readonly Light[],
  apply: (light: Light) => Promise<unknown>,
): Promise<FanOutOutcome> {
  if (lights.length === 0) {
    throw new Error("No lights to control");
  }

  const results = await Promise.allSettled(
    lights.map(async (light) => apply(light)),
  );
  const failed = results.flatMap((result, index) =>
    result.status === "rejected"
      ? [{ light: lights[index], error: result.reason }]
      : [],
  );

  if (failed.length === lights.length) {
    throw failed[0].error;
  }
  return { total: lights.length, failed };
}
