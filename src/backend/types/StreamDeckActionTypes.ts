/**
 * Extended Stream Deck action types that include missing methods
 */

import type { Action, JsonObject } from "@elgato/streamdeck";

export interface ExtendedAction<TSettings extends JsonObject = JsonObject>
  extends Action<TSettings> {
  sendToPropertyInspector(data: any): Promise<void>;
  showOk(): Promise<void>;
  showAlert(): Promise<void>;
}
