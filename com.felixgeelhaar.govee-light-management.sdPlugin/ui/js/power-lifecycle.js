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
  const refresh = document.getElementById("powerRefresh");
  let currentTarget = "";
  let editingTarget = "";
  let currentName = "";
  let rules = [];
  const names = new Map();
  let pendingEvent = "";
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
    save.textContent = rules.some(
      (rule) => rule.selectedDeviceId === editingTarget,
    )
      ? "Save changes"
      : "Create rule";
    refresh.disabled = busy;
    targetSelect.disabled = busy;
    document.querySelectorAll("#powerRuleList button").forEach((button) => {
      button.disabled = busy;
    });
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
      pendingEvent = event;
      status.className = "group-status";
      status.textContent =
        event === "savePowerLifecycleRule"
          ? "Saving rule…"
          : event === "deletePowerLifecycleRule"
            ? "Deleting rule…"
            : "Loading rules…";
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
        status.className = "group-status error";
        status.textContent =
          "Power rule response timed out. Refresh to try again.";
      }, 10000);
    };
    const nameFor = (id) =>
      names.get(id) || (id === currentTarget && currentName) || id;
    const renderRules = () => {
      const summary = panel.querySelector("summary");
      if (summary)
        summary.textContent = rules.length
          ? `Manage rules · ${rules.length}`
          : "Manage rules";
      const list = document.getElementById("powerRuleList");
      if (!list) return;
      list.replaceChildren();
      if (!rules.length) {
        const empty = document.createElement("div");
        empty.className = "group-empty";
        empty.textContent =
          "No rules yet. Choose a target and save a rule below.";
        list.appendChild(empty);
      }
      for (const rule of rules) {
        const row = document.createElement("div");
        row.className = "group-row power-rule-row";
        const label = document.createElement("span");
        label.className = "group-label";
        const name = document.createElement("div");
        name.textContent = nameFor(rule.selectedDeviceId);
        name.title = name.textContent;
        const events = [
          ["onPluginStart", "Startup"],
          ["onWake", "Wake"],
          ["offBeforeSleep", "Sleep"],
          ["offBeforeShutdown", "Shutdown / logout"],
        ]
          .filter(([field]) => rule[field] === true)
          .map(([, label]) => label);
        const detail = document.createElement("small");
        detail.textContent = `${!rule.enabled ? "Disabled" : events.length ? "Enabled" : "Inactive"} · ${events.join(", ") || "No events selected"}`;
        label.append(name, detail);
        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "group-delete-btn";
        edit.textContent = "Edit";
        edit.setAttribute("aria-label", `Edit rule for ${name.textContent}`);
        edit.disabled = busy;
        edit.addEventListener("click", () => {
          editingTarget = rule.selectedDeviceId;
          renderTargets();
          request("getPowerLifecycleRule");
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "group-delete-btn";
        remove.textContent = "Delete";
        remove.setAttribute(
          "aria-label",
          `Delete rule for ${name.textContent}`,
        );
        remove.disabled = busy;
        remove.addEventListener("click", () => {
          editingTarget = rule.selectedDeviceId;
          for (const [field, id] of Object.entries(fields))
            document.getElementById(id).value = rule[field] === true;
          renderTargets();
          request("deletePowerLifecycleRule");
        });
        row.append(label, edit, remove);
        list.appendChild(row);
      }
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
          add(
            rule.selectedDeviceId,
            `Saved rule: ${nameFor(rule.selectedDeviceId)}`,
          );
      targetSelect.value = editingTarget;
      renderRules();
    };
    const settingsChanged = (message) => {
      const settings = message.payload?.settings || message.settings || {};
      const next = canonical(settings.selectedDeviceId, settings.selectedModel);
      currentName = settings.selectedLightName || "";
      if (next && currentName) names.set(next, currentName);
      if (next === currentTarget && requestId > 0) {
        renderTargets();
        return;
      }
      currentTarget = next;
      editingTarget = next;
      currentName = settings.selectedLightName || "";
      renderTargets();
      request("getPowerLifecycleRule");
    };
    const response = (message) => {
      const payload = message.payload || message;
      if (payload.event === "getDevices" && Array.isArray(payload.items)) {
        const collect = (items) => {
          for (const item of items) {
            if (Array.isArray(item.children)) collect(item.children);
            else if (item.value && item.label)
              names.set(canonical(item.value), item.label);
          }
        };
        collect(payload.items);
        renderTargets();
        return;
      }
      if (
        payload.event !== "powerLifecycleRule" ||
        payload.requestId !== requestId
      )
        return;
      clearTimeout(timer);
      busy = false;
      if (payload.status === "error") {
        status.className = "group-status error";
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
      if (pendingEvent === "deletePowerLifecycleRule")
        status.textContent = "Rule deleted. No saved rule for this target.";
      status.className = `group-status ${noEvents || (helperNeeded && payload.helperStatus === "unavailable") ? "error" : "success"}`;
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
