import { test, expect } from "@playwright/test";

test("retired status-dot preference is not presented or rewritten", async ({
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
          handler({ payload: { settings: {} } }),
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
    });
  });
  await page.goto("/ui/on-off.html");
  await expect(page.locator('[setting="showStatusBadge"]')).toHaveCount(0);
  await expect(page.locator("#statusDotArtworkHint")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __artworkWrites: unknown[] }).__artworkWrites,
    ),
  ).toEqual([]);
});

test("On/Off has no icon switching preference; artwork belongs to the host", async ({
  page,
}) => {
  await page.goto("/ui/on-off.html");
  await expect(page.locator('[setting="separatePowerIcons"]')).toHaveCount(0);
  await expect(page.locator('sdpi-item[label="Icon switching"]')).toHaveCount(0);
  await expect(page.locator("#nativeArtworkHint")).toHaveCount(0);
});
