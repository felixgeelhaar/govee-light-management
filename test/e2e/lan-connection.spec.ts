/**
 * The metadata panel says how the plugin reaches the selected light: over
 * the local network (Govee LAN API) or the Govee cloud, and for the cloud
 * why, with a link to the website's help page.
 */
import { test, expect, type Page } from "@playwright/test";

async function mount(page: Page, connection: Record<string, unknown>) {
  await page.addInitScript((conn) => {
    type Handler = (msg: unknown) => void;
    const handlers: Record<string, Handler[]> = {
      pi: [],
      settings: [],
      global: [],
    };
    const bus = (list: Handler[]) => ({
      subscribe: (h: Handler) => list.push(h),
      unsubscribe() {},
    });
    const selectedDeviceId = "light:dev-1|H6056";
    const w = window as unknown as Record<string, unknown>;
    w.__sent = [];
    const client = {
      sendToPropertyInspector: bus(handlers.pi),
      didReceiveSettings: bus(handlers.settings),
      didReceiveGlobalSettings: bus(handlers.global),
      getSettings() {
        setTimeout(() =>
          handlers.settings.forEach((h) =>
            h({ payload: { settings: { selectedDeviceId } } }),
          ),
        );
      },
      getGlobalSettings() {
        setTimeout(() =>
          handlers.global.forEach((h) =>
            h({
              payload: { settings: { apiKey: "test-key-0000000000000000" } },
            }),
          ),
        );
      },
      setGlobalSettings() {},
      sendToPlugin(payload: Record<string, unknown>) {
        client.send("sendToPlugin", payload);
      },
      send(event: string, payload: Record<string, unknown>) {
        (w.__sent as unknown[]).push({ event, payload });
        if (payload?.event === "getDeviceDebug")
          setTimeout(() =>
            handlers.pi.forEach((h) =>
              h({
                payload: {
                  event: "deviceDebug",
                  selectedDeviceId,
                  device: {
                    device: "dev-1",
                    model: "H6056",
                    name: "Desk",
                    controllable: true,
                    retrievable: true,
                    supportedCommands: [],
                    capabilities: {},
                    connection: conn,
                  },
                },
              }),
            ),
          );
      },
    };
    Object.defineProperty(window, "SDPIComponents", {
      get: () => ({ streamDeckClient: client }),
      set() {},
      configurable: true,
    });
  }, connection);
  await page.goto("/ui/brightness.html");
  await page.locator("#deviceDebugDetails").waitFor({ state: "attached" });
  await page.evaluate(() => {
    (document.getElementById("deviceDebugDetails") as HTMLDetailsElement).open =
      true;
  });
}

test("a light found on the local network shows LAN and its address", async ({
  page,
}) => {
  await mount(page, { type: "lan", ip: "192.168.1.23" });
  await expect(page.locator("#deviceDebugValue")).toContainText(
    "LAN · 192.168.1.23",
  );
});

test("a blocked local network explains itself and links to the help page", async ({
  page,
}) => {
  await mount(page, { type: "cloud", reason: "network-blocked" });
  const panel = page.locator("#deviceDebugValue");
  await expect(panel).toContainText("local network access blocked");
  await expect(panel.locator("a[data-open-url]")).toHaveAttribute(
    "href",
    "https://felixgeelhaar.github.io/govee-light-management/lan.html",
  );
});
