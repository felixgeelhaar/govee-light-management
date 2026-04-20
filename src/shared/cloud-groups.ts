/**
 * Govee cloud-side "pseudo-group" device models that appear in
 * /router/api/v1/user/devices but are NOT controllable through the
 * public control API. Selecting one as a target silently fails every
 * command (#186, #188 — fixed in #189).
 *
 * These entries are filtered out of device discovery at the transport
 * and repository boundaries, and the Property Inspector surfaces a
 * clear hint if a stale setting still points at one.
 *
 * Shared between CloudTransport and GoveeLightRepository so both
 * filtering paths stay in sync. If Govee adds more pseudo-group
 * model names in the future, add them here once.
 */
export const UNSUPPORTED_CLOUD_GROUP_MODELS: ReadonlySet<string> = new Set([
  "BaseGroup",
  "SameModelGroup",
  "SameModeGroup",
]);

/**
 * Type-narrow helper so callers don't have to repeat the cast.
 */
export function isUnsupportedCloudGroup(model: string | undefined): boolean {
  return typeof model === "string" && UNSUPPORTED_CLOUD_GROUP_MODELS.has(model);
}
