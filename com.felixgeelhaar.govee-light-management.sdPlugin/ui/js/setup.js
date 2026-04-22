/**
 * Shared setup logic for all Property Inspectors.
 * Handles: API key flow, conditional visibility, group management.
 */
document.addEventListener("DOMContentLoaded", () => {
  const setupWrapper = document.getElementById("setup");
  const settingsWrapper = document.getElementById("settings");
  const connectElem = document.getElementById("connect");
  const apiKeyElem = document.getElementById("apiKey");
  const failedElem = document.getElementById("errorMessage");
  const API_KEY_PATTERN = /^[A-Za-z0-9-]{20,64}$/;

  // Optional conditional visibility elements
  const conditionalItems = {
    brightness: document.getElementById("brightnessItem"),
    color: document.getElementById("colorItem"),
    colorTemp: document.getElementById("tempItem"),
  };
  const hasConditionalItems = Object.values(conditionalItems).some(Boolean);
  const UNSUPPORTED_CLOUD_GROUP_MODELS = new Set([
    "BaseGroup",
    "SameModelGroup",
    "SameModeGroup",
  ]);
  const GROUP_DIAL_DESCRIPTIONS = {
    "Brightness Dial":
      "For groups, the dial shows the average brightness across the selected lights.",
    "Color Temperature Dial":
      "For groups, the dial shows the average colour temperature across the selected lights.",
    "Color Hue Dial":
      "For groups, the dial shows a blended colour position across the selected lights.",
    "Saturation Dial":
      "For groups, the dial shows the average colour richness across the selected lights.",
  };
  let latestSettings = {};
  let selectedDeviceDebug = null;
  let selectedDeviceDebugId = "";
  let pendingDeviceDebugId = "";

  function showPanel(isSetup) {
    if (isSetup) {
      setupWrapper.classList.remove("hidden");
      settingsWrapper.classList.add("hidden");
    } else {
      settingsWrapper.classList.remove("hidden");
      setupWrapper.classList.add("hidden");
    }
  }

  function updateConditionalVisibility(mode) {
    if (!hasConditionalItems) return;
    for (const [key, el] of Object.entries(conditionalItems)) {
      if (el) el.style.display = key === mode ? "" : "none";
    }
  }

  function normalizeApiKey(value) {
    if (typeof value !== "string") return "";
    return value.trim();
  }

  function hasValidApiKey(value) {
    return API_KEY_PATTERN.test(normalizeApiKey(value));
  }

  function toPayload(message) {
    if (
      message &&
      typeof message === "object" &&
      "payload" in message &&
      message.payload
    ) {
      return message.payload;
    }
    return message || {};
  }

  function sendPluginMessage(client, payload) {
    if (client && typeof client.sendToPlugin === "function") {
      client.sendToPlugin(payload);
      return;
    }

    // Fallback for older SDPI client builds that only expose `send`.
    if (client && typeof client.send === "function") {
      client.send("sendToPlugin", payload);
      return;
    }

    console.warn("sendToPlugin is unavailable on streamDeckClient", {
      event: payload && payload.event,
    });
  }

  function getSelectedDeviceId() {
    const selectedDeviceId = latestSettings?.selectedDeviceId;
    return typeof selectedDeviceId === "string" ? selectedDeviceId : "";
  }

  function getCurrentDialGroupDescription() {
    const pageTitle = document.title || "";
    for (const [key, value] of Object.entries(GROUP_DIAL_DESCRIPTIONS)) {
      if (pageTitle.includes(key)) {
        return value;
      }
    }
    return "";
  }

  function isDebugExpanded() {
    const details = document.getElementById("deviceDebugDetails");
    return Boolean(details && details.open);
  }

  function resetSelectedDeviceDebug(selectedDeviceId) {
    if (selectedDeviceDebugId === selectedDeviceId) return;
    selectedDeviceDebug = null;
    selectedDeviceDebugId = selectedDeviceId;
    pendingDeviceDebugId = "";
  }

  function requestSelectedDeviceDebug(client, force = false) {
    const selectedDeviceId = getSelectedDeviceId();

    if (!selectedDeviceId || !selectedDeviceId.startsWith("light:")) {
      pendingDeviceDebugId = "";
      return;
    }

    if (!isDebugExpanded()) {
      return;
    }

    if (!force) {
      const alreadyLoaded =
        selectedDeviceDebugId === selectedDeviceId &&
        selectedDeviceDebug !== null;
      const alreadyPending = pendingDeviceDebugId === selectedDeviceId;
      if (alreadyLoaded || alreadyPending) {
        return;
      }
    }

    resetSelectedDeviceDebug(selectedDeviceId);
    pendingDeviceDebugId = selectedDeviceId;
    sendPluginMessage(client, {
      event: "getDeviceDebug",
      selectedDeviceId,
    });
  }

  function getSelectedDeviceDebug() {
    const selectedDeviceId = getSelectedDeviceId();

    if (!selectedDeviceId) {
      return null;
    }

    if (!selectedDeviceId.startsWith("light:")) {
      return {
        selection: selectedDeviceId,
        message: "Debug device data is only available for individual lights.",
      };
    }

    if (!isDebugExpanded()) {
      return {
        selection: selectedDeviceId,
        message: "Expand this panel to load device metadata.",
      };
    }

    if (pendingDeviceDebugId === selectedDeviceId) {
      return {
        selection: selectedDeviceId,
        message: "Loading selected light metadata…",
      };
    }

    if (
      selectedDeviceDebugId !== selectedDeviceId ||
      selectedDeviceDebug === null
    ) {
      return {
        selection: selectedDeviceId,
        message: "Selected light metadata is not loaded yet.",
      };
    }

    return selectedDeviceDebug;
  }

  function renderDebugInfo() {
    const debugValue = document.getElementById("deviceDebugValue");
    if (!debugValue) return;

    const data = getSelectedDeviceDebug();
    if (!data) {
      debugValue.innerHTML =
        '<div class="metadata-empty">Select a light to inspect device metadata.</div>';
      return;
    }

    if (data.message) {
      debugValue.innerHTML = `
        <div class="metadata-panel">
          <div class="metadata-message"><strong>Selection:</strong> ${escapeHtml(data.selection ?? "Unknown")}</div>
          <div class="metadata-empty">${escapeHtml(data.message)}</div>
        </div>
      `;
      return;
    }

    const capabilities = Object.entries(data.capabilities ?? {})
      .map(
        ([key, enabled]) =>
          `<span class="${capabilityClass(Boolean(enabled))}">${escapeHtml(formatKey(key))}</span>`,
      )
      .join("");

    const commands = (data.supportedCommands ?? [])
      .map(
        (command) =>
          `<span class="metadata-tag">${escapeHtml(command)}</span>`,
      )
      .join("");

    debugValue.innerHTML = `
      <div class="metadata-panel">
        <div class="metadata-section">
          ${renderMetaRow("Name", data.name)}
          ${renderMetaRow("Device", data.device, {
            copyValue: data.device,
            copyLabel: "Click to copy device ID",
          })}
          ${renderMetaRow("Model", data.model, {
            copyValue: data.model,
            copyLabel: "Click to copy model",
          })}
        </div>
        <div class="metadata-section">
          ${renderMetaRow("Controllable", formatBoolean(data.controllable))}
          ${renderMetaRow("Retrievable", formatBoolean(data.retrievable))}
        </div>
        <div class="metadata-section">
          <div class="metadata-heading">Capabilities</div>
          <div class="metadata-tags">
            ${capabilities || '<span class="metadata-empty">None</span>'}
          </div>
        </div>
        <div class="metadata-section">
          <div class="metadata-heading">Supported Commands</div>
          <div class="metadata-tags">
            ${commands || '<span class="metadata-empty">None</span>'}
          </div>
        </div>
      </div>
    `;

    bindCopyButtons(debugValue);
  }

  function renderMetaRow(label, value, options = {}) {
    const valueContent =
      options.copyValue && value
        ? `<span
            class="metadata-copy-value"
            data-copy="${escapeHtmlAttr(options.copyValue)}"
            aria-label="${escapeHtmlAttr(options.copyLabel || `Copy ${label}`)}"
            title="${escapeHtmlAttr(options.copyLabel || `Copy ${label}`)}"
          >${escapeHtml(value ?? "Unknown")}</span>`
        : "";

    return `<div class="metadata-row"><div class="metadata-label">${escapeHtml(label)}</div><div class="metadata-value">${valueContent || `<span>${escapeHtml(value ?? "Unknown")}</span>`}</div></div>`;
  }

  function bindCopyButtons(container) {
    container.querySelectorAll(".metadata-copy-value").forEach((element) => {
      element.addEventListener("mouseenter", () => {
        element.classList.add("is-hover");
      });

      element.addEventListener("mouseleave", () => {
        element.classList.remove("is-hover");
      });

      element.addEventListener("click", async () => {
        const value = element.getAttribute("data-copy");
        if (!value) return;

        try {
          await navigator.clipboard.writeText(value);
          const originalText = element.textContent;
          const originalTitle = element.getAttribute("title");
          element.textContent = "Copied";
          element.setAttribute("title", "Copied");
          setTimeout(() => {
            element.textContent = originalText;
            if (originalTitle) {
              element.setAttribute("title", originalTitle);
            }
          }, 1200);
        } catch (error) {
          console.warn("Failed to copy metadata value", error);
        }
      });
    });
  }

  function formatBoolean(value) {
    return value ? "Yes" : "No";
  }

  function formatKey(value) {
    return String(value)
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (char) => char.toUpperCase())
      .trim();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeHtmlAttr(value) {
    return escapeHtml(value);
  }

  function capabilityClass(enabled) {
    return enabled
      ? "metadata-tag metadata-tag-enabled"
      : "metadata-tag metadata-tag-disabled";
  }

  function subscribePluginMessages(client, onMessage) {
    const sources = [
      client && client.sendToPropertyInspector,
      client && client.message,
    ].filter(Boolean);

    // Track { source, handler } pairs for proper cleanup.
    // SDPI client subscribe(handler) returns undefined, so we can't rely on
    // subscription.unsubscribe() - we must call source.unsubscribe(handler).
    const subscriptions = [];

    sources.forEach((source) => {
      if (source && typeof source.subscribe === "function") {
        const handler = (message) => {
          onMessage(toPayload(message));
        };
        source.subscribe(handler);
        subscriptions.push({ source, handler });
      }
    });

    if (subscriptions.length > 0) {
      return () => {
        subscriptions.forEach(({ source, handler }) => {
          // SDPI client: unsubscribe(handler) to remove the specific handler
          if (source && typeof source.unsubscribe === "function") {
            source.unsubscribe(handler);
          }
        });
      };
    }

    const legacyHandler = (evt) => onMessage(evt.detail || {});
    document.addEventListener("sdpi:message", legacyHandler);
    return () => {
      document.removeEventListener("sdpi:message", legacyHandler);
    };
  }

  function injectApiKeyActions(client) {
    if (!settingsWrapper || document.getElementById("editApiKeyBtn")) return;

    const item = document.createElement("sdpi-item");
    item.setAttribute("label", "API Key");

    const button = document.createElement("button");
    button.type = "button";
    button.id = "editApiKeyBtn";
    button.className = "sdpi-item-value group-cancel-btn";
    button.textContent = "Change API Key";
    button.addEventListener("click", () => {
      failedElem.classList.add("hidden");
      showPanel(true);
      apiKeyElem.focus();
    });

    item.appendChild(button);
    settingsWrapper.insertBefore(item, settingsWrapper.firstChild);

    const debugItem = document.createElement("sdpi-item");
    debugItem.setAttribute("label", "Metadata");
    debugItem.innerHTML = `
      <details class="sdpi-item-value metadata-details" id="deviceDebugDetails">
        <summary>Selected device metadata</summary>
        <div id="deviceDebugValue" class="metadata-content">
          <div class="metadata-empty">Select a light to inspect device metadata.</div>
        </div>
      </details>
    `;
    settingsWrapper.appendChild(debugItem);
    const debugDetails = debugItem.querySelector("#deviceDebugDetails");
    if (debugDetails) {
      debugDetails.addEventListener("toggle", () => {
        renderDebugInfo();
        requestSelectedDeviceDebug(client, true);
      });
    }
    renderDebugInfo();
  }

  function initSharedMessageHandlers(client) {
    const unsubscribeMessages = subscribePluginMessages(client, (p) => {
      if (!p || typeof p !== "object") return;

      if (p.event === "deviceDebug") {
        const currentSelectedDeviceId = getSelectedDeviceId();
        if (p.selectedDeviceId && p.selectedDeviceId === currentSelectedDeviceId) {
          selectedDeviceDebugId = p.selectedDeviceId;
          selectedDeviceDebug = p.device || null;
          pendingDeviceDebugId = "";
          renderDebugInfo();
        }
      }
    });

    window.addEventListener("beforeunload", unsubscribeMessages, {
      once: true,
    });
  }

  // Keep a reference to the latest global settings so we can merge, not replace.
  let cachedGlobalSettings = {};

  // ── API Key Validation ──
  connectElem.addEventListener("click", async () => {
    const candidateKey = normalizeApiKey(apiKeyElem.value);
    if (!hasValidApiKey(candidateKey)) {
      failedElem.textContent = "Please enter a valid Govee API key.";
      failedElem.classList.remove("hidden");
      return;
    }

    apiKeyElem.disabled = true;
    connectElem.disabled = true;
    connectElem.innerText = "Connecting...";
    failedElem.classList.add("hidden");

    try {
      const res = await fetch(
        "https://openapi.api.govee.com/router/api/v1/user/devices",
        {
          headers: {
            "Content-Type": "application/json",
            "Govee-API-Key": candidateKey,
          },
        },
      );
      if (res.ok) {
        // Merge with existing global settings to preserve light groups etc.
        SDPIComponents.streamDeckClient.setGlobalSettings({
          ...cachedGlobalSettings,
          apiKey: candidateKey,
        });
        showPanel(false);
        document.querySelectorAll("sdpi-select[datasource]").forEach((el) => {
          if (el.refresh) el.refresh();
        });
      } else {
        failedElem.textContent =
          res.status === 401
            ? "Invalid API key. Please check and try again."
            : "Failed to connect, please try again.";
        failedElem.classList.remove("hidden");
      }
    } catch {
      failedElem.textContent =
        "Could not reach Govee servers. Check your internet connection.";
      failedElem.classList.remove("hidden");
    }

    apiKeyElem.disabled = false;
    connectElem.disabled = false;
    connectElem.innerText = "Connect";
  });

  // ── Group Manager (injected into every PI) ──
  function initGroupManager(client) {
    const container = document.getElementById("groupManager");
    if (!container) return;

    let devices = [];

    container.innerHTML = `
			<hr class="group-separator" />
			<sdpi-item label="Groups">
				<div>
					<div id="groupList"></div>
					<button type="button" id="newGroupBtn" class="sdpi-item-value group-add-btn">+ New Group</button>
				</div>
			</sdpi-item>
			<div id="groupCreateForm" style="display:none">
				<sdpi-item label="Name">
					<input id="groupNameInput" type="text" class="sdpi-item-value" placeholder="e.g. Living Room" />
				</sdpi-item>
				<sdpi-item label="Lights">
					<div id="groupLightList" class="light-checklist"></div>
				</sdpi-item>
				<div class="group-btn-row">
					<button type="button" id="saveGroupBtn" class="group-action-btn">Create</button>
					<button type="button" id="cancelGroupBtn" class="group-cancel-btn">Cancel</button>
				</div>
			</div>
			<div id="groupStatus" class="group-status"></div>
		`;

    const groupList = document.getElementById("groupList");
    const createForm = document.getElementById("groupCreateForm");
    const lightList = document.getElementById("groupLightList");
    const nameInput = document.getElementById("groupNameInput");
    const statusEl = document.getElementById("groupStatus");

    function showStatus(msg, isError) {
      statusEl.textContent = msg;
      statusEl.className = "group-status " + (isError ? "error" : "success");
      setTimeout(() => {
        statusEl.textContent = "";
      }, 3000);
    }

    function renderGroups(groups) {
      groupList.innerHTML = "";
      if (groups.length === 0) {
        groupList.innerHTML = '<span class="group-empty">No groups yet</span>';
        return;
      }
      groups.forEach((g) => {
        const row = document.createElement("div");
        row.className = "group-row";
        row.innerHTML = `
					<span class="group-label">${g.name} <small>(${g.size || "?"} lights)</small></span>
					<button class="group-delete-btn" data-id="${g.id}">✕</button>
				`;
        row.querySelector(".group-delete-btn").addEventListener("click", () => {
          if (confirm("Delete group '" + g.name + "'?")) {
            sendPluginMessage(client, { event: "deleteGroup", groupId: g.id });
          }
        });
        groupList.appendChild(row);
      });
    }

    document.getElementById("newGroupBtn").addEventListener("click", () => {
      nameInput.value = "";
      lightList.innerHTML = "";
      if (devices.length === 0) {
        lightList.innerHTML =
          '<div style="padding:4px;color:#999">No devices found</div>';
      } else {
        devices.forEach((d) => {
          const label = document.createElement("label");
          label.innerHTML = `<input type="checkbox" name="grpLight" value="${d.value}"> ${d.label}`;
          lightList.appendChild(label);
        });
      }
      createForm.style.display = "";
    });

    document.getElementById("cancelGroupBtn").addEventListener("click", () => {
      createForm.style.display = "none";
    });

    document.getElementById("saveGroupBtn").addEventListener("click", () => {
      const name = nameInput.value.trim();
      const checked = [
        ...document.querySelectorAll('input[name="grpLight"]:checked'),
      ];
      if (!name) {
        showStatus("Enter a name", true);
        return;
      }
      if (checked.length === 0) {
        showStatus("Select lights", true);
        return;
      }
      sendPluginMessage(client, {
        event: "saveGroup",
        group: { name, lightIds: checked.map((cb) => cb.value) },
      });
    });

    const unsubscribeMessages = subscribePluginMessages(client, (p) => {
      if (!p || typeof p !== "object") return;

      if (p.event === "getDevices" && p.items) {
        // Flatten: items may have children (Lights/Groups optgroups)
        devices = [];
        (p.items || []).forEach((item) => {
          if (item.children) {
            // Only include lights for group creation (not groups)
            if (item.label === "Lights") {
              devices.push(...item.children);
            }
          } else if (item.value) {
            devices.push(item);
          }
        });
        renderDebugInfo();
        requestSelectedDeviceDebug(client);
      }

      if (p.event === "groupsReceived" && p.groups) {
        renderGroups(p.groups);
      }

      if (p.event === "groupSaved") {
        if (p.success) {
          showStatus("Group created!", false);
          createForm.style.display = "none";
          sendPluginMessage(client, { event: "getGroups" });
          // Refresh device dropdown to include new group
          document.querySelectorAll("sdpi-select[datasource]").forEach((el) => {
            if (el.refresh) el.refresh();
          });
        } else {
          showStatus(p.error || "Failed", true);
        }
      }

      if (p.event === "groupDeleted") {
        if (p.success) {
          showStatus("Deleted", false);
          sendPluginMessage(client, { event: "getGroups" });
          document.querySelectorAll("sdpi-select[datasource]").forEach((el) => {
            if (el.refresh) el.refresh();
          });
        } else {
          showStatus(p.error || "Failed", true);
        }
      }
    });

    window.addEventListener("beforeunload", unsubscribeMessages, {
      once: true,
    });

    // Fetch groups and devices
    sendPluginMessage(client, { event: "getGroups" });
    sendPluginMessage(client, { event: "getDevices" });
  }

  // ── Device Dropdown Status ──
  // Wires the Device dropdown to the shared attachFieldStatus helper so
  // explicit backend errors ("Missing API key", "Failed to load devices") are
  // surfaced, plus a 15s fallback hint if the backend never responds at all
  // (e.g. plugin crashed).
  function watchDeviceDropdown(client) {
    const TIMEOUT_MS = 15_000;
    const deviceSelect = document.querySelector(
      'sdpi-select[setting="selectedDeviceId"]',
    );
    if (!deviceSelect) return;
    const unsupportedHint = document.createElement("div");
    unsupportedHint.id = "deviceUnsupported";
    unsupportedHint.className = "field-hint error hidden";
    deviceSelect.parentNode.insertBefore(unsupportedHint, deviceSelect.nextSibling);
    const groupHint = document.createElement("div");
    groupHint.id = "deviceGroupHint";
    groupHint.className = "field-hint info hidden";
    unsupportedHint.parentNode.insertBefore(groupHint, unsupportedHint.nextSibling);

    function getSelectedModel(selectedDeviceId) {
      if (typeof selectedDeviceId !== "string") return "";
      if (!selectedDeviceId.startsWith("light:")) return "";
      const raw = selectedDeviceId.substring(6);
      const parts = raw.split("|");
      return parts.length >= 2 ? parts[1] : "";
    }

    function updateUnsupportedHint() {
      const selectedDeviceId =
        deviceSelect.value ||
        (typeof latestSettings?.selectedDeviceId === "string"
          ? latestSettings.selectedDeviceId
          : "");
      const model = getSelectedModel(selectedDeviceId);
      if (UNSUPPORTED_CLOUD_GROUP_MODELS.has(model)) {
        unsupportedHint.textContent =
          "Govee cloud groups like BaseGroup / SameModelGroup are not supported. Use a plugin group instead.";
        unsupportedHint.className = "field-hint error";
      } else {
        unsupportedHint.textContent = "";
        unsupportedHint.className = "field-hint error hidden";
      }
    }

    function updateGroupHint() {
      const selectedDeviceId =
        deviceSelect.value ||
        (typeof latestSettings?.selectedDeviceId === "string"
          ? latestSettings.selectedDeviceId
          : "");
      const description = getCurrentDialGroupDescription();

      if (selectedDeviceId.startsWith("group:") && description) {
        groupHint.textContent = description;
        groupHint.className = "field-hint info";
      } else {
        groupHint.textContent = "";
        groupHint.className = "field-hint info hidden";
      }
    }

    const rerenderDebug = () => {
      const selectedDeviceId = deviceSelect.value || "";
      resetSelectedDeviceDebug(selectedDeviceId);
      latestSettings = {
        ...latestSettings,
        selectedDeviceId,
      };
      updateUnsupportedHint();
      updateGroupHint();
      renderDebugInfo();
      requestSelectedDeviceDebug(client);
    };

    deviceSelect.addEventListener("valuechange", rerenderDebug);
    deviceSelect.addEventListener("change", rerenderDebug);
    deviceSelect.addEventListener("input", rerenderDebug);

    attachFieldStatus(client, deviceSelect, "getDevices", {
      emptyMsg:
        "No devices found. Add lights in the Govee mobile app, then refresh.",
      errorMsg:
        "Failed to load devices. Check your API key and connection, then refresh.",
    });

    // Fallback: if no getDevices response arrives at all (plugin crashed,
    // message lost), show a hint after the timeout window.
    const timer = setTimeout(() => {
      const hasOptions =
        deviceSelect.querySelectorAll("option").length > 0 ||
        deviceSelect.value;
      if (hasOptions) return;
      if (document.getElementById("deviceTimeout")) return;
      const hint = document.createElement("div");
      hint.id = "deviceTimeout";
      hint.className = "field-hint error";
      hint.textContent =
        "Devices didn't load. Check your API key, try the refresh button, or restart the Stream Deck app.";
      deviceSelect.parentNode.insertBefore(hint, deviceSelect.nextSibling);
    }, TIMEOUT_MS);

    const unsubscribeMessages = subscribePluginMessages(client, (p) => {
      if (!p || typeof p !== "object") return;
      if (p.event === "getDevices") {
        clearTimeout(timer);
        const hint = document.getElementById("deviceTimeout");
        if (hint) hint.remove();
        updateUnsupportedHint();
        updateGroupHint();
        renderDebugInfo();
        requestSelectedDeviceDebug(client);
        unsubscribeMessages();
      }
    });

    updateUnsupportedHint();
    updateGroupHint();
  }

  // ── Field Status Hints ──
  // Attaches an inline hint element below a dependent dropdown and updates it
  // based on backend responses. Used to distinguish "empty because no device
  // selected" (default placeholder) from "empty because device has no items"
  // or "empty because the backend errored". Shared across all PIs.
  function attachFieldStatus(client, selectEl, event, opts) {
    if (!selectEl || !event) return () => {};
    const { emptyMsg, errorMsg, timeoutMs = 15_000 } = opts || {};
    const parent = selectEl.parentNode;
    if (!parent) return () => {};

    const hint = document.createElement("div");
    hint.className = "field-hint info hidden";
    hint.setAttribute("data-field-hint", event);
    parent.insertBefore(hint, selectEl.nextSibling);

    let timer = null;

    function show(text, kind) {
      hint.textContent = text;
      hint.className = `field-hint ${kind}`;
    }
    function hide() {
      hint.textContent = "";
      hint.className = "field-hint info hidden";
    }

    function armTimeout() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        // Only show the timeout hint if the dropdown is still empty
        const hasOptions =
          selectEl.querySelectorAll("option").length > 0 || selectEl.value;
        if (!hasOptions && errorMsg) {
          show(
            "Request timed out. Check your connection, API key, or Stream Deck plugin state.",
            "error",
          );
        }
      }, timeoutMs);
    }

    const unsubscribe = subscribePluginMessages(client, (p) => {
      if (!p || typeof p !== "object" || p.event !== event) return;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const status = p.status;
      const message = typeof p.message === "string" ? p.message : null;
      const items = Array.isArray(p.items) ? p.items : [];

      if (status === "error") {
        show(message || errorMsg || "Failed to load options.", "error");
        return;
      }
      if (status === "empty") {
        show(message || emptyMsg || "No options available.", "info");
        return;
      }
      if (items.length === 0 && status === "ok") {
        // Backend explicitly said ok but list is empty (rare; treat as empty)
        show(message || emptyMsg || "No options available.", "info");
        return;
      }
      if (items.length > 0) {
        hide();
        return;
      }
      // No status field (legacy): keep hint hidden — placeholder does its job.
    });

    return {
      armTimeout,
      hide,
      dispose: () => {
        if (timer) clearTimeout(timer);
        unsubscribe();
        if (hint.parentNode) hint.parentNode.removeChild(hint);
      },
    };
  }

  // ── Ready Queue ──
  // Per-PI scripts can call GoveePI.ready(fn) to receive the SDPI client
  // once it's initialized. Handles both "registered before ready" and
  // "registered after ready" cases.
  const readyQueue = [];
  let readyClient = null;
  function fireReady(client) {
    readyClient = client;
    while (readyQueue.length) {
      const fn = readyQueue.shift();
      try {
        fn(client);
      } catch (error) {
        console.warn("GoveePI.ready callback failed", error);
      }
    }
  }

  window.GoveePI = window.GoveePI || {};
  window.GoveePI.ready = function (fn) {
    if (typeof fn !== "function") return;
    if (readyClient) fn(readyClient);
    else readyQueue.push(fn);
  };
  window.GoveePI.attachFieldStatus = function (selectEl, event, opts) {
    if (!readyClient) {
      // Defer until ready
      let handle = null;
      const pending = { dispose: () => handle && handle.dispose() };
      window.GoveePI.ready((client) => {
        handle = attachFieldStatus(client, selectEl, event, opts);
      });
      return pending;
    }
    return attachFieldStatus(readyClient, selectEl, event, opts);
  };

  // ── Initialize ──
  function init() {
    const client = SDPIComponents.streamDeckClient;
    injectApiKeyActions(client);
    initSharedMessageHandlers(client);

    client.didReceiveGlobalSettings.subscribe((msg) => {
      cachedGlobalSettings = msg.payload?.settings || {};
      const apiKey = cachedGlobalSettings.apiKey;
      showPanel(!hasValidApiKey(apiKey));
    });

    if (hasConditionalItems) {
      client.didReceiveSettings.subscribe((msg) => {
        const nextSettings = msg.payload?.settings || {};
        resetSelectedDeviceDebug(nextSettings.selectedDeviceId || "");
        latestSettings = nextSettings;
        const mode = latestSettings?.controlMode;
        if (mode) updateConditionalVisibility(mode);
        renderDebugInfo();
        requestSelectedDeviceDebug(client);
      });
    } else {
      client.didReceiveSettings.subscribe((msg) => {
        const nextSettings = msg.payload?.settings || {};
        resetSelectedDeviceDebug(nextSettings.selectedDeviceId || "");
        latestSettings = nextSettings;
        renderDebugInfo();
        requestSelectedDeviceDebug(client);
      });
    }

    if (client && typeof client.getSettings === "function") {
      client.getSettings();
    }
    client.getGlobalSettings();
    watchDeviceDropdown(client);
    renderDebugInfo();
    try {
      initGroupManager(client);
    } catch (error) {
      console.warn("Failed to initialize group manager", error);
    }
    fireReady(client);
  }

  const check = setInterval(() => {
    if (
      typeof SDPIComponents !== "undefined" &&
      SDPIComponents.streamDeckClient
    ) {
      clearInterval(check);
      init();
    }
  }, 50);

  setTimeout(() => {
    clearInterval(check);
    if (
      setupWrapper.classList.contains("hidden") &&
      settingsWrapper.classList.contains("hidden")
    ) {
      showPanel(true);
    }
  }, 3000);

  updateConditionalVisibility("toggle");
});
