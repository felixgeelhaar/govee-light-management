/**
 * WebSocket message types for communication between Property Inspector and Stream Deck plugin
 */
import type { LightItem } from './lights';

/**
 * Base message structure for all WebSocket communications
 */
export interface BaseMessage {
  /** Event type identifier */
  event: string;
  /** Optional payload data */
  [key: string]: unknown;
}

/**
 * Messages sent from Property Inspector to plugin
 */
export namespace PropertyInspectorMessages {
  /** Request to fetch available lights */
  export interface GetLights extends BaseMessage {
    event: 'getLights';
  }

  /** Request to fetch available groups */
  export interface GetGroups extends BaseMessage {
    event: 'getGroups';
  }

  /** Request to create a new group */
  export interface CreateGroup extends BaseMessage {
    event: 'createGroup';
    groupName: string;
    selectedLightIds: string[];
  }

  /** Request to get details of a specific group */
  export interface GetGroupDetails extends BaseMessage {
    event: 'getGroupDetails';
    groupId: string;
  }

  /** Request to edit an existing group */
  export interface EditGroup extends BaseMessage {
    event: 'editGroup';
    groupId: string;
    groupName: string;
    selectedLightIds: string[];
  }

  /** Request to delete a group */
  export interface DeleteGroup extends BaseMessage {
    event: 'deleteGroup';
    groupId: string;
  }

  /** Request to test a group (blink lights) */
  export interface TestGroup extends BaseMessage {
    event: 'testGroup';
  }

  /** Request to refresh state */
  export interface RefreshState extends BaseMessage {
    event: 'refreshState';
  }

  export type All = 
    | GetLights 
    | GetGroups 
    | CreateGroup 
    | GetGroupDetails 
    | EditGroup 
    | DeleteGroup 
    | TestGroup 
    | RefreshState;
}

/**
 * Messages sent from plugin to Property Inspector
 */
export namespace PluginMessages {
  /** Response with available lights */
  export interface GetLights extends BaseMessage {
    event: 'getLights';
    items: LightItem[];
  }

  /** Response with available groups */
  export interface GetGroups extends BaseMessage {
    event: 'getGroups';
    items: GroupItem[];
  }

  /** Response after group creation */
  export interface GroupCreated extends BaseMessage {
    event: 'groupCreated';
    success: boolean;
    group?: {
      id: string;
      name: string;
      lightCount: number;
    };
    message?: string;
  }

  /** Response with group details */
  export interface GroupDetails extends BaseMessage {
    event: 'groupDetails';
    group: {
      id: string;
      name: string;
      lightIds: string[];
      lightCount: number;
    };
  }

  /** Response after group edit */
  export interface GroupEdited extends BaseMessage {
    event: 'groupEdited';
    success: boolean;
    group?: {
      id: string;
      name: string;
      lightCount: number;
    };
    message?: string;
  }

  /** Response after group deletion */
  export interface GroupDeleted extends BaseMessage {
    event: 'groupDeleted';
    success: boolean;
    message: string;
  }

  /** Response from group test */
  export interface TestResult extends BaseMessage {
    event: 'testResult';
    success: boolean;
    message: string;
  }

  /** Generic error message */
  export interface Error extends BaseMessage {
    event: 'error';
    message: string;
  }

  export type All = 
    | GetLights 
    | GetGroups 
    | GroupCreated 
    | GroupDetails 
    | GroupEdited 
    | GroupDeleted 
    | TestResult 
    | Error;
}

/**
 * Light item for dropdown selection lists
 */
export interface LightDropdownItem {
  /** Display label for the light */
  label: string;
  /** Value in format "deviceId|model" */
  value: string;
}

/**
 * Group item for selection lists
 */
export interface GroupItem {
  /** Display label for the group */
  label: string;
  /** Group ID value */
  value: string;
}