/**
 * Inspectors whose second dropdown depends on the chosen light (scene, mode,
 * snapshot, recall look, toggle feature) clear that dropdown when the light
 * changes. The first light an inspector sees is the saved one: opening a key
 * again must keep its settings, so only a move from one light to another (or
 * clearing the light) counts as a switch.
 */
(function () {
  function isSwitch(previous, next) {
    return Boolean(previous) && previous !== next;
  }

  window.GoveeDeviceSwitch = { isSwitch };
})();
