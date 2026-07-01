import { Schedule, ScheduleJSON } from "../value-objects/Schedule";

export type ScheduledActionTarget = "light" | "group";

export type ScheduledCommand =
  "on" | "off" | "toggle" | "brightness" | "color" | "colorTemperature";

export interface ScheduledActionJSON {
  id: string;
  name: string;
  schedule: ScheduleJSON;
  targetId: string;
  targetType: ScheduledActionTarget;
  command: ScheduledCommand;
  commandValue?: number | string;
}

export interface ScheduledActionProps {
  id: string;
  name: string;
  schedule: Schedule;
  targetId: string;
  targetType: ScheduledActionTarget;
  command: ScheduledCommand;
  commandValue?: number | string;
}

/**
 * Entity representing a scheduled light action.
 * Pairs a Schedule with a target (light/group) and command to execute.
 */
export class ScheduledAction {
  private constructor(private readonly props: ScheduledActionProps) {}

  static create(props: ScheduledActionProps): ScheduledAction {
    if (!props.id || props.id.trim() === "") {
      throw new Error("ID cannot be empty");
    }
    if (!props.name || props.name.trim() === "") {
      throw new Error("Name cannot be empty");
    }
    if (!props.targetId || props.targetId.trim() === "") {
      throw new Error("Target ID cannot be empty");
    }
    return new ScheduledAction({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get schedule(): Schedule {
    return this.props.schedule;
  }

  get targetId(): string {
    return this.props.targetId;
  }

  get targetType(): ScheduledActionTarget {
    return this.props.targetType;
  }

  get command(): ScheduledCommand {
    return this.props.command;
  }

  get commandValue(): number | string | undefined {
    return this.props.commandValue;
  }

  isEnabled(): boolean {
    return this.props.schedule.isActive;
  }

  nextTriggerAt(): Date | null {
    return this.props.schedule.nextTriggerAt();
  }

  withSchedule(schedule: Schedule): ScheduledAction {
    return new ScheduledAction({ ...this.props, schedule });
  }

  toJSON(): ScheduledActionJSON {
    return {
      id: this.props.id,
      name: this.props.name,
      schedule: this.props.schedule.toJSON(),
      targetId: this.props.targetId,
      targetType: this.props.targetType,
      command: this.props.command,
      commandValue: this.props.commandValue,
    };
  }

  static fromJSON(json: ScheduledActionJSON): ScheduledAction {
    return ScheduledAction.create({
      id: json.id,
      name: json.name,
      schedule: Schedule.fromJSON(json.schedule),
      targetId: json.targetId,
      targetType: json.targetType,
      command: json.command,
      commandValue: json.commandValue,
    });
  }
}
