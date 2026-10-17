import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
const script = readFileSync(
  "com.felixgeelhaar.govee-light-management.sdPlugin/ui/js/power-lifecycle.js",
  "utf8",
);
afterEach(() => window.dispatchEvent(new Event("beforeunload")));
describe("power rule status", () => {
  it("distinguishes enabled rules with no events from active and disabled rules", () => {
    document.body.innerHTML =
      '<details id="powerLifecyclePanel"></details><select id="powerRuleTarget"></select><p id="powerLifecycleStatus"></p><button id="powerSave"></button><button id="powerDelete"></button><button id="powerRefresh"></button>' +
      [
        "powerEnabled",
        "powerStartup",
        "powerWake",
        "powerSleep",
        "powerShutdown",
      ]
        .map((id) => `<input type="checkbox" id="${id}">`)
        .join("");
    const messages = { subscribe: vi.fn(), unsubscribe: vi.fn() };
    const settings = { subscribe: vi.fn(), unsubscribe: vi.fn() };
    const send = vi.fn();
    const client = {
      sendToPropertyInspector: messages,
      didReceiveSettings: settings,
      sendToPlugin: send,
      getSettings: vi.fn(),
    };
    Object.assign(window, {
      GoveePI: {
        ready: (callback: (value: typeof client) => void) => callback(client),
      },
    });
    window.eval(script);
    document.dispatchEvent(new Event("DOMContentLoaded"));
    settings.subscribe.mock.calls[0][0]({
      payload: { settings: { selectedDeviceId: "dev-1|H619A" } },
    });
    const response = messages.subscribe.mock.calls[0][0];
    const reply = (rule: Record<string, unknown>) =>
      response({
        payload: {
          event: "powerLifecycleRule",
          requestId: send.mock.calls.at(-1)?.[0].requestId,
          status: "ok",
          rules: [],
          rule,
          helperStatus: "disabled",
        },
      });
    reply({ enabled: true });
    expect(
      document.getElementById("powerLifecycleStatus")?.textContent,
    ).toContain("no events selected");
    reply({ enabled: true, onPluginStart: true });
    expect(
      document.getElementById("powerLifecycleStatus")?.textContent,
    ).not.toContain("inactive");
    reply({ enabled: false, onPluginStart: true });
    expect(
      document.getElementById("powerLifecycleStatus")?.textContent,
    ).toContain("Automation is disabled");
  });
});
