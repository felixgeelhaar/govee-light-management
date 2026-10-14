import { test, expect } from "@playwright/test";

test("status-dot control follows separate artwork without changing its global preference", async ({
  page,
}) => {
  await page.addInitScript(() => {
    type Handler = (message: {
      payload: { settings: Record<string, unknown> };
    }) => void;
    const settingsHandlers: Handler[] = [];
    const globalHandlers: Handler[] = [];
    const event = (handlers: Handler[]) => ({
      subscribe: (handler: Handler) => handlers.push(handler),
      unsubscribe: (handler: Handler) => {
        const index = handlers.indexOf(handler);
        if (index >= 0) handlers.splice(index, 1);
      },
    });
    const writes: unknown[] = [];
    const client = {
      didReceiveSettings: event(settingsHandlers),
      didReceiveGlobalSettings: event(globalHandlers),
      getSettings: () =>
        settingsHandlers.forEach((handler) =>
          handler({ payload: { settings: { separatePowerIcons: "true" } } }),
        ),
      getGlobalSettings: () =>
        globalHandlers.forEach((handler) =>
          handler({
            payload: {
              settings: {
                apiKey: "test-key-1234567890123456",
                showStatusBadge: true,
              },
            },
          }),
        ),
      setGlobalSettings: (settings: unknown) => writes.push(settings),
      sendToPlugin() {},
      send() {},
    };
    Object.defineProperty(window, "SDPIComponents", {
      get: () => ({ streamDeckClient: client }),
      set() {},
      configurable: true,
    });
    Object.assign(window, {
      __artworkWrites: writes,
      __artworkSettings: (value: unknown) =>
        settingsHandlers.forEach((handler) =>
          handler({ payload: { settings: { separatePowerIcons: value } } }),
        ),
    });
  });
  await page.goto("/ui/on-off.html");
  const dot = page.locator('sdpi-select[setting="showStatusBadge"]');
  await expect(dot).toHaveAttribute("disabled", "");
  await expect(dot.locator("select")).toBeDisabled();
  await expect(page.locator("#statusDotArtworkHint")).toBeVisible();

  for (const enabled of [false, true, "false", "true"]) {
    await page.evaluate(
      (value) =>
        (
          window as unknown as { __artworkSettings: (value: unknown) => void }
        ).__artworkSettings(value),
      enabled,
    );
    if (enabled === true || enabled === "true")
      await expect(dot.locator("select")).toBeDisabled();
    else await expect(dot.locator("select")).toBeEnabled();
  }
  await page
    .locator('sdpi-select[setting="separatePowerIcons"]')
    .evaluate((element) => {
      (element as HTMLElement & { value: string }).value = "false";
      element.dispatchEvent(new Event("valuechange"));
    });
  await expect(dot.locator("select")).toBeEnabled();
  await expect(page.locator("#statusDotArtworkHint")).toBeHidden();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __artworkWrites: unknown[] }).__artworkWrites,
    ),
  ).toEqual([]);
});

test("artwork choices explain state switching and native image reset", async ({
  page,
}) => {
  await page.goto("/ui/on-off.html");
  const icons = page.locator('sdpi-select[setting="separatePowerIcons"]');
  expect(
    await icons.evaluate((element) =>
      element.querySelector('option[value="false"]')?.textContent?.trim(),
    ),
  ).toBe("Use On icon for both states");
  expect(
    await icons.evaluate((element) =>
      element.querySelector('option[value="true"]')?.textContent?.trim(),
    ),
  ).toBe("Switch On/Off icons");
  await expect(page.locator("#nativeArtworkHint")).toContainText(
    "Reset to Default",
  );
  await expect(page.locator("#nativeArtworkHint")).toContainText(
    "does not remove",
  );
});
