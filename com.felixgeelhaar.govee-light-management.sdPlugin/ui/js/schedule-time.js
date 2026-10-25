/**
 * Time helpers for the Schedule inspector. Schedules are entered in the
 * computer's local time and saved with `clock: "local"`; keys saved before
 * 3.0.1 hold UTC hour/minute/days and no clock, and are converted once.
 */
(function () {
  const pad = (value) => String(value).padStart(2, "0");

  /** "HH:MM" for the time picker, or "" when no time is saved. */
  function timeText(hour, minute) {
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return "";
    return `${pad(hour)}:${pad(minute)}`;
  }

  /** Settings fields for a picked "HH:MM", or null for an incomplete value. */
  function localTimeFields(text) {
    const match = /^(\d{1,2}):(\d{2})/.exec(text || "");
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    return { hour, minute, clock: "local" };
  }

  /**
   * The local equivalent of a legacy UTC schedule, or null when the
   * settings are already local or hold no time. Days move with the time
   * when the UTC time falls on a different local date.
   */
  function toLocalSchedule(settings, now = new Date()) {
    if (!settings || settings.clock === "local") return null;
    if (!Number.isInteger(settings.hour) || !Number.isInteger(settings.minute))
      return null;
    const at = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        settings.hour,
        settings.minute,
      ),
    );
    const shift = (at.getDay() - at.getUTCDay() + 7) % 7;
    const dayShift = shift === 6 ? -1 : shift;
    const local = {
      hour: at.getHours(),
      minute: at.getMinutes(),
      clock: "local",
    };
    if (Array.isArray(settings.days))
      local.days = settings.days
        .map((day) => (day + dayShift + 7) % 7)
        .sort((a, b) => a - b);
    return local;
  }

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const COMMANDS = {
    on: "Turn on",
    off: "Turn off",
    toggle: "Toggle",
    brightness: "Brightness",
  };

  /**
   * One line describing a saved schedule for the "Manage schedules" list:
   * when it repeats (in local time), what it does, and to which light.
   */
  function describeSchedule(item, names = {}) {
    const local = toLocalSchedule(item) || item;
    const time = timeText(local.hour, local.minute);
    const days = (local.days || [])
      .slice()
      .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
      .map((day) => DAY_NAMES[day])
      .join(", ");
    const when =
      item.type === "delay"
        ? `Once after ${item.delaySeconds}s`
        : item.type === "weekly"
          ? `${days} ${time}`
          : `Every day ${time}`;
    let command = COMMANDS[item.command] || item.command;
    if (item.command === "brightness" && item.commandValue !== undefined)
      command += ` ${item.commandValue}%`;
    const target = names[item.targetId] || item.targetId;
    return `${when} · ${command} · ${target}`;
  }

  window.GoveeScheduleTime = {
    timeText,
    localTimeFields,
    toLocalSchedule,
    describeSchedule,
  };
})();
