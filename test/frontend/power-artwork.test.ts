import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const script = readFileSync(
  "com.felixgeelhaar.govee-light-management.sdPlugin/ui/js/power-artwork.js",
  "utf8",
);

describe("power artwork inspector lifecycle", () => {
  it("keeps the global preference intact and removes its listeners on unload", () => {
    document.body.innerHTML =
      '<sdpi-select setting="separatePowerIcons"></sdpi-select><sdpi-select setting="showStatusBadge"></sdpi-select><p id="statusDotArtworkHint" class="hidden"></p>';
    const icons = document.querySelector(
      '[setting="separatePowerIcons"]',
    ) as HTMLElement & { value: unknown };
    const dot = document.querySelector(
      '[setting="showStatusBadge"]',
    ) as HTMLElement & { disabled: boolean };
    const client = {
      didReceiveSettings: { subscribe: vi.fn(), unsubscribe: vi.fn() },
      getSettings: vi.fn(),
      setGlobalSettings: vi.fn(),
    };
    Object.assign(window, {
      GoveePI: {
        ready: (callback: (value: typeof client) => void) => callback(client),
      },
    });
    window.eval(script);
    document.dispatchEvent(new Event("DOMContentLoaded"));
    const receive = client.didReceiveSettings.subscribe.mock.calls[0][0];
    receive({ payload: { settings: { separatePowerIcons: true } } });
    expect(dot.disabled).toBe(true);
    receive({ payload: { settings: { separatePowerIcons: "false" } } });
    expect(dot.disabled).toBe(false);
    icons.value = "true";
    icons.dispatchEvent(new Event("valuechange"));
    expect(dot.disabled).toBe(true);
    expect(client.setGlobalSettings).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("beforeunload"));
    expect(client.didReceiveSettings.unsubscribe).toHaveBeenCalledWith(receive);
    icons.value = "false";
    icons.dispatchEvent(new Event("valuechange"));
    expect(dot.disabled).toBe(true);
  });
});
