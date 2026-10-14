/** Keep the global status-dot preference intact when native artwork is selected. */
document.addEventListener("DOMContentLoaded", () => {
  const icons = document.querySelector(
    'sdpi-select[setting="separatePowerIcons"]',
  );
  const dot = document.querySelector('sdpi-select[setting="showStatusBadge"]');
  const hint = document.getElementById("statusDotArtworkHint");
  if (!icons || !dot || !hint) return;

  function update(value) {
    const separate = value === true || value === "true";
    dot.disabled = separate;
    hint.classList.toggle("hidden", !separate);
  }

  window.GoveePI.ready((client) => {
    const receive = (message) =>
      update(message.payload?.settings?.separatePowerIcons);
    const changed = () => update(icons.value);
    client.didReceiveSettings.subscribe(receive);
    icons.addEventListener("valuechange", changed);
    client.getSettings();
    window.addEventListener(
      "beforeunload",
      () => {
        client.didReceiveSettings.unsubscribe(receive);
        icons.removeEventListener("valuechange", changed);
      },
      { once: true },
    );
  });
});
