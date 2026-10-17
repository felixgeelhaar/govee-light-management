/** Global power-rule editor. Nothing is persisted until Save/Delete is pressed. */
document.addEventListener("DOMContentLoaded", () => {
  const panel = document.getElementById("powerLifecyclePanel");
  if (!panel) return;
  const body = document.getElementById("powerLifecycleBody");
  const syncPanel = () => body?.classList.toggle("hidden", !panel.open);
  panel.addEventListener("toggle", syncPanel);
  syncPanel();
  const fields = {
    enabled: "powerEnabled",
    onPluginStart: "powerStartup",
    onWake: "powerWake",
    offBeforeSleep: "powerSleep",
    offBeforeShutdown: "powerShutdown",
  };
  const targetSelect = document.getElementById("powerRuleTarget");
  const status = document.getElementById("powerLifecycleStatus");
  const save = document.getElementById("powerSave");
  const remove = document.getElementById("powerDelete");
  const refresh = document.getElementById("powerRefresh");
  let currentTarget = "";
  let editingTarget = "";
  let currentName = "";
  let rules = [];
  let requestId = 0;
  let timer;
  let busy = false;
  const canonical = (value, model) =>
    !value
      ? ""
      : value.startsWith("group:") || value.startsWith("light:")
        ? value
        : `light:${value.includes("|") ? value : `${value}|${model || ""}`}`;
  const controls = () => {
    save.disabled = busy || !editingTarget;
    remove.disabled = busy || !editingTarget;
    refresh.disabled = busy;
    for (const id of Object.values(fields))
      document.getElementById(id).disabled = busy || !editingTarget;
  };
  controls();
  window.GoveePI.ready((client) => {
    const send = (payload) => {
      if (typeof client.sendToPlugin === "function")
        client.sendToPlugin(payload);
      else client.send("sendToPlugin", payload);
    };
    const request = (event, rule) => {
      clearTimeout(timer);
      busy = true;
      controls();
      send({
        event,
        selectedDeviceId: editingTarget,
        rule,
        requestId: ++requestId,
      });
      timer = setTimeout(() => {
        busy = false;
        controls();
        status.textContent =
          "Power rule response timed out. Refresh to try again.";
      }, 10000);
    };
    const renderTargets = () => {
      targetSelect.replaceChildren();
      const add = (value, label) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        targetSelect.appendChild(option);
      };
      add(
        currentTarget,
        currentTarget
          ? `Current selection: ${currentName || currentTarget}`
          : "Select a light/group above or a saved rule",
      );
      for (const rule of rules)
        if (rule.selectedDeviceId !== currentTarget)
          add(rule.selectedDeviceId, `Saved rule: ${rule.selectedDeviceId}`);
      targetSelect.value = editingTarget;
    };
    const settingsChanged = (message) => {
      const settings = message.payload?.settings || message.settings || {};
      const next = canonical(settings.selectedDeviceId, settings.selectedModel);
      if (next === currentTarget && requestId > 0) return;
      currentTarget = next;
      editingTarget = next;
      currentName = settings.selectedLightName || "";
      renderTargets();
      request("getPowerLifecycleRule");
    };
    const response = (message) => {
      const payload = message.payload || message;
      if (
        payload.event !== "powerLifecycleRule" ||
        payload.requestId !== requestId
      )
        return;
      clearTimeout(timer);
      busy = false;
      if (payload.status === "error") {
        status.textContent =
          payload.message || "Power rule could not be saved.";
        controls();
        return;
      }
      rules = payload.rules || [];
      renderTargets();
      for (const [field, id] of Object.entries(fields))
        document.getElementById(id).value = payload.rule?.[field] === true;
      const helperNeeded =
        payload.rule?.enabled &&
        (payload.rule.offBeforeSleep || payload.rule.offBeforeShutdown);
      const noEvents =
        payload.rule?.enabled &&
        [
          "onPluginStart",
          "onWake",
          "offBeforeSleep",
          "offBeforeShutdown",
        ].every((event) => payload.rule[event] !== true);
      status.textContent = noEvents
        ? "Rule saved but inactive: no events selected. Select a startup, wake, sleep or shutdown event and save again."
        : payload.rule && !payload.rule.enabled
          ? "Rule saved. Automation is disabled."
          : helperNeeded
            ? {
                ready: "Rule saved. Sleep/shutdown monitoring is ready.",
                starting:
                  "Rule saved. Sleep/shutdown monitoring is starting; refresh to confirm.",
                unavailable:
                  "Sleep/shutdown monitoring is unavailable. Startup/wake can still work.",
                disabled: "Sleep/shutdown monitoring is disabled.",
              }[payload.helperStatus] ||
              "Refresh to check sleep/shutdown support."
            : payload.rule
              ? "Rule saved. Startup/wake automation is enabled."
              : "No saved rule for this target.";
      controls();
    };
    const sources = [client.sendToPropertyInspector, client.message].filter(
      (source) => typeof source?.subscribe === "function",
    );
    for (const source of sources) source.subscribe(response);
    client.didReceiveSettings.subscribe(settingsChanged);
    targetSelect.addEventListener("valuechange", () => {
      if (targetSelect.value === editingTarget) return;
      editingTarget = targetSelect.value;
      request("getPowerLifecycleRule");
    });
    save.addEventListener("click", () => {
      const rule = Object.fromEntries(
        Object.entries(fields).map(([field, id]) => [
          field,
          document.getElementById(id).value === true,
        ]),
      );
      request("savePowerLifecycleRule", rule);
    });
    remove.addEventListener("click", () => request("deletePowerLifecycleRule"));
    refresh.addEventListener("click", () => request("getPowerLifecycleRule"));
    client.getSettings();
    window.addEventListener(
      "beforeunload",
      () => {
        clearTimeout(timer);
        panel.removeEventListener("toggle", syncPanel);
        client.didReceiveSettings.unsubscribe(settingsChanged);
        for (const source of sources) source.unsubscribe(response);
      },
      { once: true },
    );
  });
});
