import { test, expect } from "@playwright/test";

test("PC power rules are opt-in and expose honest lifecycle limits", async ({
  page,
}) => {
  await page.goto("/ui/on-off.html");
  const panel = page.locator("#powerLifecyclePanel");
  await expect(panel).toBeAttached();
  for (const id of [
    "powerEnabled",
    "powerStartup",
    "powerWake",
    "powerSleep",
    "powerShutdown",
  ]) {
    await expect(page.locator(`#${id}`)).not.toBeChecked();
  }
  await expect(panel).toContainText("best effort");
  await expect(panel).toContainText("Manual commands");
  await expect(
    page.locator('script[src="./js/power-lifecycle.js"]'),
  ).toBeAttached();
});

async function mockClient(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    type Handler = (message: unknown) => void;
    const settings: Handler[] = [];
    const global: Handler[] = [];
    const replies: Handler[] = [];
    const bus = (handlers: Handler[]) => ({
      subscribe: (handler: Handler) => handlers.push(handler),
      unsubscribe: (handler: Handler) => {
        const index = handlers.indexOf(handler);
        if (index >= 0) handlers.splice(index, 1);
      },
    });
    const calls: Record<string, unknown>[] = [];
    const client = {
      didReceiveSettings: bus(settings),
      didReceiveGlobalSettings: bus(global),
      sendToPropertyInspector: bus(replies),
      getSettings() {
        setTimeout(
          () =>
            settings.forEach((handler) =>
              handler({
                payload: {
                  settings: {
                    selectedDeviceId: "dev-1|H619A",
                    selectedLightName: "Desk",
                  },
                },
              }),
            ),
          0,
        );
      },
      getGlobalSettings() {
        setTimeout(
          () =>
            global.forEach((handler) =>
              handler({
                payload: { settings: { apiKey: "test-key-for-browser-1234" } },
              }),
            ),
          0,
        );
      },
      setGlobalSettings() {},
      send() {},
      sendToPlugin(payload: Record<string, unknown>) {
        calls.push(payload);
        if (
          [
            "getPowerLifecycleRule",
            "savePowerLifecycleRule",
            "deletePowerLifecycleRule",
          ].includes(String(payload.event))
        ) {
          setTimeout(
            () =>
              replies.forEach((handler) =>
                handler({
                  payload: {
                    event: "powerLifecycleRule",
                    status: "ok",
                    selectedDeviceId: "light:dev-1|H619A",
                    requestId: payload.requestId,
                    rule:
                      payload.event === "savePowerLifecycleRule"
                        ? payload.rule
                        : null,
                    rules: [],
                    helperStatus: "disabled",
                  },
                }),
              ),
            0,
          );
        }
      },
    };
    Object.defineProperty(window, "SDPIComponents", {
      configurable: true,
      get: () => ({ streamDeckClient: client }),
      set() {},
    });
    (
      window as unknown as { powerCalls: Record<string, unknown>[] }
    ).powerCalls = calls;
  });
}

test("editing controls sends no command or storage mutation until explicit Save", async ({
  page,
}) => {
  await mockClient(page);
  await page.goto("/ui/on-off.html");
  await page.locator("#powerLifecyclePanel summary").click();
  await expect(page.locator("#powerSave")).toBeEnabled();
  await page.locator("#powerEnabled").check();
  await page.locator("#powerWake").check();
  const before = await page.evaluate(() =>
    (
      window as unknown as { powerCalls: Record<string, unknown>[] }
    ).powerCalls.filter((call) => call.event === "savePowerLifecycleRule"),
  );
  expect(before).toEqual([]);
  await page.locator("#powerSave").click();
  await expect(page.locator("#powerLifecycleStatus")).toContainText(
    "Rule saved",
  );
  const calls = await page.evaluate(
    () =>
      (window as unknown as { powerCalls: Record<string, unknown>[] })
        .powerCalls,
  );
  expect(
    calls.find((call) => call.event === "savePowerLifecycleRule"),
  ).toMatchObject({
    selectedDeviceId: "light:dev-1|H619A",
    rule: {
      enabled: true,
      onWake: true,
      offBeforeSleep: false,
      offBeforeShutdown: false,
    },
  });
  expect(
    calls.some((call) => call.event === "control" || call.event === "turnOn"),
  ).toBe(false);
  await page.locator("#powerDelete").click();
  await expect(page.locator("#powerLifecycleStatus")).toContainText(
    "No saved rule",
  );
});

test("an enabled rule without event choices is clearly marked inactive", async ({
  page,
}) => {
  await mockClient(page);
  await page.goto("/ui/on-off.html");
  await page.locator("#powerLifecyclePanel summary").click();
  await expect(page.locator("#powerSave")).toBeEnabled();
  await page.locator("#powerEnabled").check();
  await page.locator("#powerSave").click();
  await expect(page.locator("#powerLifecycleStatus")).toContainText(
    "no events selected",
  );
  await page.locator("#powerStartup").check();
  await page.locator("#powerSave").click();
  await expect(page.locator("#powerLifecycleStatus")).not.toContainText(
    "inactive",
  );
  await page.locator("#powerEnabled").uncheck();
  await page.locator("#powerSave").click();
  await expect(page.locator("#powerLifecycleStatus")).toContainText(
    "Automation is disabled",
  );
});
