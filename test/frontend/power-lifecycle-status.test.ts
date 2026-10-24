import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
const script = readFileSync(
  "com.felixgeelhaar.govee-light-management.sdPlugin/ui/js/power-lifecycle.js",
  "utf8",
);
afterEach(() => window.dispatchEvent(new Event("beforeunload")));
describe("power rule status", () => {
  const mount = () => {
    document.body.innerHTML =
      '<sdpi-select setting="selectedDeviceId"><select><option value="light:dev-2|H6056">Backlight (H6056)</option></select></sdpi-select>' +
      '<details id="powerLifecyclePanel"><summary></summary></details><div id="powerRuleList"></div><p id="powerRuleTarget"></p><p id="powerLifecycleStatus"></p><button id="powerSave"></button><button id="powerDelete"></button><button id="powerRefresh"></button>' +
      [
        "powerEnabled",
        "powerStartup",
        "powerWake",
        "powerSleep",
        "powerShutdown",
      ]
        .map((id) => `<sdpi-checkbox id="${id}"></sdpi-checkbox>`)
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
    return {
      send,
      changeSettings: settings.subscribe.mock.calls[0][0],
      response: messages.subscribe.mock.calls[0][0],
    };
  };
  const target = () => document.getElementById("powerRuleTarget");

  it("takes the rule target from the light selected above, without a dropdown", () => {
    const { send, changeSettings } = mount();
    expect(
      document.querySelector(
        "#powerLifecycleBody select, sdpi-select#powerRuleTarget",
      ),
    ).toBeNull();
    expect(target()?.textContent).toContain("Select a light or group above");
    changeSettings({
      payload: {
        settings: {
          selectedDeviceId: "dev-1|H619A",
          selectedLightName: "Desk",
        },
      },
    });
    expect(target()?.textContent).toBe("Desk");
    expect(send.mock.calls.at(-1)?.[0]).toMatchObject({
      event: "getPowerLifecycleRule",
      selectedDeviceId: "light:dev-1|H619A",
    });
    changeSettings({
      payload: {
        settings: { selectedDeviceId: "group:room", selectedLightName: "Room" },
      },
    });
    expect(target()?.textContent).toBe("Room");
    expect(send.mock.calls.at(-1)?.[0]).toMatchObject({
      event: "getPowerLifecycleRule",
      selectedDeviceId: "group:room",
    });
  });

  it("follows a device chosen in the inspector, which the host does not echo back", () => {
    const { send, changeSettings } = mount();
    changeSettings({
      payload: {
        settings: {
          selectedDeviceId: "dev-1|H619A",
          selectedLightName: "Desk",
        },
      },
    });
    const device = document.querySelector(
      'sdpi-select[setting="selectedDeviceId"]',
    ) as HTMLElement & { value?: string };
    const option = device.querySelector("option") as HTMLOptionElement;
    option.selected = true;
    device.value = "light:dev-2|H6056";
    device.dispatchEvent(new Event("valuechange"));
    expect(target()?.textContent).toBe("Backlight (H6056)");
    expect(send.mock.calls.at(-1)?.[0]).toMatchObject({
      event: "getPowerLifecycleRule",
      selectedDeviceId: "light:dev-2|H6056",
    });
  });

  it("distinguishes enabled rules with no events from active and disabled rules", () => {
    const { send, changeSettings, response } = mount();
    changeSettings({
      payload: { settings: { selectedDeviceId: "dev-1|H619A" } },
    });
    const reply = (
      rule: Record<string, unknown>,
      rules: Record<string, unknown>[] = [],
    ) =>
      response({
        payload: {
          event: "powerLifecycleRule",
          requestId: send.mock.calls.at(-1)?.[0].requestId,
          status: "ok",
          rules,
          rule,
          helperStatus: "disabled",
        },
      });
    reply({ enabled: true });
    expect(document.getElementById("powerRuleList")?.textContent).toContain(
      "No rules yet",
    );
    expect(
      document.getElementById("powerLifecycleStatus")?.textContent,
    ).toContain("no events selected");
    reply({ enabled: true, onPluginStart: true });
    expect(
      document.getElementById("powerLifecycleStatus")?.textContent,
    ).not.toContain("inactive");
    reply({ enabled: false, onPluginStart: true }, [
      { selectedDeviceId: "light:dev-1|H619A", enabled: false, onWake: true },
      { selectedDeviceId: "group:room", enabled: true },
    ]);
    expect(
      document.querySelector("#powerLifecyclePanel summary")?.textContent,
    ).toBe("Manage rules · 2");
    expect(document.getElementById("powerRuleList")?.textContent).toContain(
      "Disabled · Wake",
    );
    expect(document.getElementById("powerRuleList")?.textContent).toContain(
      "Inactive · No events selected",
    );
    response({
      payload: {
        event: "getDevices",
        items: [
          {
            label: "Groups",
            children: [
              { value: "group:room", label: "<img src=x onerror=alert(1)>" },
            ],
          },
        ],
      },
    });
    expect(document.getElementById("powerRuleList")?.textContent).toContain(
      "<img src=x onerror=alert(1)>",
    );
    expect(document.querySelector("#powerRuleList img")).toBeNull();
    (
      document.querySelectorAll("#powerRuleList button")[2] as HTMLButtonElement
    ).click();
    expect(send.mock.calls.at(-1)?.[0]).toMatchObject({
      event: "getPowerLifecycleRule",
      selectedDeviceId: "group:room",
    });
    response({
      payload: {
        event: "powerLifecycleRule",
        requestId: send.mock.calls.at(-1)?.[0].requestId,
        status: "error",
        message: "Unable to load rules",
      },
    });
    expect(document.querySelectorAll("#powerRuleList button")).toHaveLength(4);
    expect(
      document.getElementById("powerLifecycleStatus")?.className,
    ).toContain("error");
    reply({ enabled: false, onPluginStart: true });
    expect(
      document.getElementById("powerLifecycleStatus")?.textContent,
    ).toContain("Automation is disabled");
  });
});
