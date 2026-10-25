/**
 * Schedule types supported by the scheduling system
 */
export enum ScheduleType {
  OneTime = "one-time",
  Delay = "delay",
  Daily = "daily",
  Weekly = "weekly",
}

/**
 * Days of the week (0=Sunday, 6=Saturday — matches Date.getDay())
 */
export enum DayOfWeek {
  Sunday = 0,
  Monday = 1,
  Tuesday = 2,
  Wednesday = 3,
  Thursday = 4,
  Friday = 5,
  Saturday = 6,
}

/**
 * Clock that daily/weekly hour, minute and days are read in. Schedules are
 * entered in the computer's local time; "utc" remains for schedules saved
 * before 3.0.1, whose times were entered as UTC.
 */
export type ScheduleClock = "local" | "utc";

/**
 * Serializable schedule representation
 */
export interface ScheduleJSON {
  type: ScheduleType;
  isActive: boolean;
  triggerAt?: string;
  delaySeconds?: number;
  delayStartAt?: string;
  hour?: number;
  minute?: number;
  days?: DayOfWeek[];
  fired?: boolean;
  clock?: ScheduleClock;
}

/**
 * Immutable schedule value object.
 * Supports one-time, delay-based, daily, and weekly recurrence patterns.
 */
export class Schedule {
  private constructor(
    public readonly type: ScheduleType,
    public readonly isActive: boolean,
    private readonly data: {
      triggerAt?: Date;
      delaySeconds?: number;
      delayStartAt?: Date;
      hour?: number;
      minute?: number;
      days?: DayOfWeek[];
      fired?: boolean;
      clock?: ScheduleClock;
    },
  ) {}

  // ─── Factory Methods ─────────────────────────────────────

  static oneTime(triggerAt: Date): Schedule {
    if (triggerAt.getTime() <= Date.now()) {
      throw new Error("One-time schedule must be in the future");
    }
    return new Schedule(ScheduleType.OneTime, true, {
      triggerAt,
      fired: false,
    });
  }

  static delay(seconds: number): Schedule {
    if (seconds <= 0) {
      throw new Error("Delay must be positive");
    }
    if (seconds > 86_400) {
      throw new Error("Delay must be less than 24 hours");
    }
    return new Schedule(ScheduleType.Delay, true, {
      delaySeconds: seconds,
      delayStartAt: new Date(),
      fired: false,
    });
  }

  static daily(
    hour: number,
    minute: number,
    clock: ScheduleClock = "local",
  ): Schedule {
    Schedule.validateTime(hour, minute);
    return new Schedule(ScheduleType.Daily, true, { hour, minute, clock });
  }

  static weekly(
    days: DayOfWeek[],
    hour: number,
    minute: number,
    clock: ScheduleClock = "local",
  ): Schedule {
    if (days.length === 0) {
      throw new Error("Weekly schedule requires at least one day");
    }
    Schedule.validateTime(hour, minute);
    return new Schedule(ScheduleType.Weekly, true, {
      days: [...days].sort(),
      hour,
      minute,
      clock,
    });
  }

  private static validateTime(hour: number, minute: number): void {
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      throw new Error("Invalid hour: must be 0-23");
    }
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
      throw new Error("Invalid minute: must be 0-59");
    }
  }

  // ─── Instance Methods ────────────────────────────────────

  /**
   * Calculates the next time this schedule will trigger.
   * Returns null if schedule is inactive, fired (one-time), or has no upcoming trigger.
   */
  nextTriggerAt(): Date | null {
    if (!this.isActive) return null;

    switch (this.type) {
      case ScheduleType.OneTime:
        return this.data.fired ? null : (this.data.triggerAt ?? null);

      case ScheduleType.Delay: {
        if (this.data.fired) return null;
        const start = this.data.delayStartAt!.getTime();
        return new Date(start + this.data.delaySeconds! * 1000);
      }

      case ScheduleType.Daily:
        return this.calculateNextDaily();

      case ScheduleType.Weekly:
        return this.calculateNextWeekly();
    }
  }

  /** The schedule's time on the day `offset` days from `now`, in its clock. */
  private timeOnDay(now: Date, offset: number): { at: Date; day: DayOfWeek } {
    const { hour, minute } = this.data;
    if (this.data.clock === "utc") {
      const at = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + offset,
          hour!,
          minute!,
        ),
      );
      return { at, day: at.getUTCDay() as DayOfWeek };
    }
    // Local fields, so the time holds across daylight-saving changes.
    const at = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + offset,
      hour!,
      minute!,
    );
    return { at, day: at.getDay() as DayOfWeek };
  }

  private calculateNextDaily(): Date {
    const now = new Date();
    const today = this.timeOnDay(now, 0).at;
    return today.getTime() > now.getTime() ? today : this.timeOnDay(now, 1).at;
  }

  private calculateNextWeekly(): Date {
    const now = new Date();
    const days = this.data.days!;

    for (let offset = 0; offset < 14; offset++) {
      const { at, day } = this.timeOnDay(now, offset);
      if (days.includes(day) && at.getTime() > now.getTime()) return at;
    }
    throw new Error("Could not find next weekly trigger");
  }

  /**
   * Returns a new Schedule with `fired` set to true.
   * For one-time and delay schedules, this prevents future triggers.
   */
  markFired(): Schedule {
    return new Schedule(this.type, this.isActive, {
      ...this.data,
      fired: true,
    });
  }

  /**
   * Returns a new Schedule with isActive = false.
   */
  disable(): Schedule {
    return new Schedule(this.type, false, { ...this.data });
  }

  /**
   * Returns a new Schedule with isActive = true.
   */
  enable(): Schedule {
    return new Schedule(this.type, true, { ...this.data });
  }

  // ─── Serialization ───────────────────────────────────────

  toJSON(): ScheduleJSON {
    return {
      type: this.type,
      isActive: this.isActive,
      triggerAt: this.data.triggerAt?.toISOString(),
      delaySeconds: this.data.delaySeconds,
      delayStartAt: this.data.delayStartAt?.toISOString(),
      hour: this.data.hour,
      minute: this.data.minute,
      days: this.data.days ? [...this.data.days] : undefined,
      fired: this.data.fired,
      clock: this.data.clock,
    };
  }

  static fromJSON(json: ScheduleJSON): Schedule {
    const data = {
      triggerAt: json.triggerAt ? new Date(json.triggerAt) : undefined,
      delaySeconds: json.delaySeconds,
      delayStartAt: json.delayStartAt ? new Date(json.delayStartAt) : undefined,
      hour: json.hour,
      minute: json.minute,
      days: json.days,
      fired: json.fired,
      // Persisted before 3.0.1, when daily/weekly times were UTC.
      clock: json.clock ?? "utc",
    };
    return new Schedule(json.type, json.isActive, data);
  }
}
