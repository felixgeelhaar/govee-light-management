import { test, expect } from "@playwright/test";

test("Automation rules are opt-in and expose honest lifecycle limits", async ({
  page,
}) => {
  await page.goto("/ui/on-off.html");
  const panel = page.locator("#powerLifecyclePanel");
  await expect(panel).toBeAttached();
  await expect(page.locator('sdpi-item[label="Automation"]')).toBeAttached();
  await expect(page.locator("#powerLifecycleBody")).toBeHidden();
  await expect(page.locator('sdpi-item[label="PC power"]')).toHaveCount(0);
  for (const id of [
    "powerEnabled",
    "powerStartup",
    "powerWake",
    "powerSleep",
    "powerShutdown",
  ]) {
    await expect(
      page.locator(`#${id} input[type="checkbox"]`),
    ).not.toBeChecked();
  }
  await expect(page.locator("#powerLifecycleBody")).toContainText(
    "best effort",
  );
  await expect(page.locator("#powerLifecycleBody")).toContainText(
    "Manual commands",
  );
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
    let rules: Record<string, unknown>[] = [];
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
          if (payload.event === "savePowerLifecycleRule")
            rules = [
              {
                ...(payload.rule as object),
                selectedDeviceId: payload.selectedDeviceId,
              },
            ];
          if (payload.event === "deletePowerLifecycleRule") rules = [];
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
                        : rules.find(
                            (rule) =>
                              rule.selectedDeviceId ===
                              payload.selectedDeviceId,
                          ) || null,
                    rules,
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
  await expect(page.locator("#powerSave button")).toBeEnabled();
  await page.locator("#powerEnabled label").click();
  await page.locator("#powerWake label").click();
  const before = await page.evaluate(() =>
    (
      window as unknown as { powerCalls: Record<string, unknown>[] }
    ).powerCalls.filter((call) => call.event === "savePowerLifecycleRule"),
  );
  expect(before).toEqual([]);
  await page.locator("#powerSave button").click();
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
  await page
    .getByRole("button", { name: "Delete rule for Desk", exact: true })
    .click();
  await expect(page.locator("#powerLifecycleStatus")).toContainText(
    "Rule deleted",
  );
});

test("an enabled rule without event choices is clearly marked inactive", async ({
  page,
}) => {
  await mockClient(page);
  await page.goto("/ui/on-off.html");
  await page.locator("#powerLifecyclePanel summary").click();
  await expect(page.locator("#powerSave button")).toBeEnabled();
  await page.locator("#powerEnabled label").click();
  await page.locator("#powerSave button").click();
  await expect(page.locator("#powerLifecycleStatus")).toContainText(
    "no events selected",
  );
  await page.locator("#powerStartup label").click();
  await page.locator("#powerSave button").click();
  await expect(page.locator("#powerLifecycleStatus")).not.toContainText(
    "inactive",
  );
  await page.locator("#powerEnabled label").click();
  await page.locator("#powerSave button").click();
  await expect(page.locator("#powerLifecycleStatus")).toContainText(
    "Automation is disabled",
  );
});

test("Automation uses native inspector components without automatic persistence", async ({
  page,
}, testInfo) => {
  await mockClient(page);
  await page.setViewportSize({ width: 370, height: 1100 });
  await page.goto("/ui/on-off.html");
  await page.locator("#powerLifecyclePanel summary").click();
  await expect(page.locator("#powerLifecycleBody")).toBeVisible();
  await expect(page.locator("#powerLifecycleBody sdpi-select")).toHaveCount(0);
  await expect(page.locator("#powerRuleTarget")).toHaveText("Desk");
  await expect(page.locator("#powerLifecycleBody sdpi-checkbox")).toHaveCount(
    5,
  );
  await expect(page.locator("#powerLifecycleBody sdpi-button")).toHaveCount(2);
  await expect(page.locator("#powerLifecycleBody [setting]")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as { powerCalls: Record<string, unknown>[] }
        ).powerCalls.filter((call) => call.event === "getPowerLifecycleRule")
          .length,
    ),
  ).toBe(1);
  await page.addStyleTag({ content: "body { background: #2d2d2d; }" });
  await page.screenshot({
    path: testInfo.outputPath("automation-inspector.png"),
    fullPage: true,
  });
  await page.locator("#powerLifecyclePanel summary").click();
  await expect(page.locator("#powerLifecycleBody")).toBeHidden();
});

test("saved rules remain visible with count, target, state and events", async ({
  page,
}, testInfo) => {
  await mockClient(page);
  await page.goto("/ui/on-off.html");
  await page.locator("#powerLifecyclePanel summary").click();
  await expect(page.locator("#powerRuleList")).toContainText("No rules yet");
  await expect(page.locator("#powerSave")).toHaveText("Create rule");
  await expect(page.locator("#powerDelete")).toHaveCount(0);
  await page.locator("#powerEnabled label").click();
  await page.locator("#powerStartup label").click();
  await page.locator("#powerSave button").click();
  await expect(page.locator("#powerSave")).toHaveText("Save changes");
  await expect(page.locator("#powerLifecyclePanel summary")).toHaveText(
    "Manage rules · 1",
  );
  await expect(page.locator("#powerRuleList")).toContainText("Desk");
  await expect(page.locator("#powerRuleList")).toContainText(
    "Enabled · Startup",
  );
  await page.setViewportSize({ width: 370, height: 1100 });
  await page.addStyleTag({ content: "body { background: #2d2d2d; }" });
  await page.screenshot({
    path: testInfo.outputPath("saved-rules.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Edit rule for Desk", exact: true })
    .click();
  await expect(page.locator("#powerStartup input")).toBeChecked();
  await page
    .getByRole("button", { name: "Delete rule for Desk", exact: true })
    .click();
  await expect(page.locator("#powerLifecycleStatus")).toContainText(
    "Rule deleted",
  );
  await expect(page.locator("#powerRuleList")).toContainText("No rules yet");
  await expect(page.locator("#powerLifecyclePanel summary")).toHaveText(
    "Manage rules",
  );
});
