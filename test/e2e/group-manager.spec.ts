import { test, expect } from "@playwright/test";

test("Groups uses native create/edit controls and saved entries like Automation", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    type Group = {
      id?: string;
      name: string;
      lightIds: string[];
      size?: number;
    };
    type Payload = { event?: string; group?: Group; [key: string]: unknown };
    const settings: ((p: Payload) => void)[] = [];
    const global: ((p: Payload) => void)[] = [];
    const replies: ((p: Payload) => void)[] = [];
    const bus = (list: ((p: Payload) => void)[]) => ({
      subscribe: (f: (p: Payload) => void) => list.push(f),
      unsubscribe() {},
    });
    let groups: Payload[] = [];
    const calls: Payload[] = [];
    const emit = (payload: Payload) =>
      setTimeout(() => replies.forEach((f) => f({ payload })), 0);
    const client = {
      didReceiveSettings: bus(settings),
      didReceiveGlobalSettings: bus(global),
      sendToPropertyInspector: bus(replies),
      getSettings() {
        setTimeout(
          () => settings.forEach((f) => f({ payload: { settings: {} } })),
          0,
        );
      },
      getGlobalSettings() {
        setTimeout(
          () =>
            global.forEach((f) =>
              f({
                payload: { settings: { apiKey: "browser-test-key-12345678" } },
              }),
            ),
          0,
        );
      },
      setGlobalSettings() {},
      send() {},
      sendToPlugin(p: Payload) {
        calls.push(p);
        if (p.event === "getGroups") emit({ event: "groupsReceived", groups });
        if (p.event === "getDevices")
          emit({
            event: "getDevices",
            status: "ok",
            items: [
              {
                label: "Lights",
                children: [
                  { value: "light:a|H6001", label: "Desk" },
                  { value: "light:b|H6001", label: "Shelf" },
                ],
              },
            ],
          });
        if (p.event === "saveGroup" && p.group) {
          const group = {
            ...p.group,
            id: p.group.id || "g1",
            size: p.group.lightIds.length,
          };
          groups = [group];
          emit({ event: "groupSaved", success: true, group });
        }
        if (p.event === "deleteGroup") {
          groups = [];
          emit({ event: "groupDeleted", success: true });
        }
      },
    };
    Object.defineProperty(window, "SDPIComponents", {
      configurable: true,
      get: () => ({ streamDeckClient: client }),
      set() {},
    });
    Object.assign(window, { groupCalls: calls });
  });
  await page.setViewportSize({ width: 370, height: 1100 });
  await page.goto("/ui/on-off.html");
  await page.locator("#groupManagerSummary").click();
  await page.locator("#newGroupBtn").click();
  await expect(page.locator("sdpi-button#saveGroupBtn")).toHaveText(
    "Create group",
  );
  await page.locator("#groupNameInput input").fill("Office");
  await expect(page.locator("#groupLightList sdpi-checkbox")).toHaveCount(2);
  await page
    .locator('#groupLightList sdpi-checkbox[label="Desk"] label')
    .click();
  await page.locator("#saveGroupBtn button").click();
  await expect(page.locator("#groupManagerSummary")).toHaveText(
    "Manage groups · 1",
  );
  await expect(page.locator("#groupList")).toContainText("1 light");
  await page
    .getByRole("button", { name: "Edit group Office", exact: true })
    .click();
  await expect(page.locator("#saveGroupBtn")).toHaveText("Save changes");
  await expect(
    page.locator('#groupLightList sdpi-checkbox[label="Desk"] input'),
  ).toBeChecked();
  await page.locator("#groupNameInput input").fill("Living room");
  await page
    .locator('#groupLightList sdpi-checkbox[label="Shelf"] label')
    .click();
  await page.addStyleTag({ content: "body { background: #2d2d2d; }" });
  await page.screenshot({
    path: testInfo.outputPath("group-editor.png"),
    fullPage: true,
  });
  await page.locator("#saveGroupBtn button").click();
  await expect(page.locator("#groupList")).toContainText("Living room");
  await expect(page.locator("#groupList")).toContainText("2 lights");
  const saves = await page.evaluate(() =>
    (
      window as unknown as {
        groupCalls: {
          event: string;
          group?: { id?: string; name: string; lightIds: string[] };
        }[];
      }
    ).groupCalls.filter((p) => p.event === "saveGroup"),
  );
  expect(saves[1].group).toMatchObject({
    id: "g1",
    name: "Living room",
    lightIds: ["light:a|H6001", "light:b|H6001"],
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.addStyleTag({ content: "body { background: #2d2d2d; }" });
  await page.screenshot({
    path: testInfo.outputPath("groups.png"),
    fullPage: true,
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete group Living room", exact: true })
    .click();
  await expect(page.locator("#groupList")).toContainText("No groups yet");
  await expect(page.locator("#groupStatus")).toContainText("Group deleted");
});
