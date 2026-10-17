/* macOS JXA event observer. No device data or credentials enter this process. */
ObjC.import("AppKit");
ObjC.import("Foundation");
let running = true;
const input = $.NSFileHandle.fileHandleWithStandardInput;
const output = $.NSFileHandle.fileHandleWithStandardOutput;
function emit(event) {
  output.writeData($(event + "\n").dataUsingEncoding($.NSUTF8StringEncoding));
}
ObjC.registerSubclass({
  name: "GoveePowerObserver",
  superclass: "NSObject",
  methods: {
    "sleep:": {
      types: ["void", ["id"]],
      implementation: function () {
        emit("sleep");
      },
    },
    "wake:": {
      types: ["void", ["id"]],
      implementation: function () {
        emit("wake");
      },
    },
    "shutdown:": {
      types: ["void", ["id"]],
      implementation: function () {
        emit("shutdown");
      },
    },
    "input:": {
      types: ["void", ["id"]],
      implementation: function (notification) {
        const data = notification.userInfo.objectForKey(
          $.NSFileHandleNotificationDataItem,
        );
        if (Number(data.length) === 0) running = false;
        else input.readInBackgroundAndNotify;
      },
    },
  },
});
const observer = $.GoveePowerObserver.alloc.init;
const workspace = $.NSWorkspace.sharedWorkspace.notificationCenter;
const center = $.NSNotificationCenter.defaultCenter;
workspace.addObserverSelectorNameObject(
  observer,
  "sleep:",
  $.NSWorkspaceWillSleepNotification,
  null,
);
workspace.addObserverSelectorNameObject(
  observer,
  "wake:",
  $.NSWorkspaceDidWakeNotification,
  null,
);
workspace.addObserverSelectorNameObject(
  observer,
  "shutdown:",
  $.NSWorkspaceWillPowerOffNotification,
  null,
);
center.addObserverSelectorNameObject(
  observer,
  "input:",
  $.NSFileHandleReadCompletionNotification,
  input,
);
input.readInBackgroundAndNotify;
emit("ready");
try {
  // Run one native run-loop iteration per event. No power-state polling.
  while (running)
    $.NSRunLoop.currentRunLoop.runModeBeforeDate(
      $.NSDefaultRunLoopMode,
      $.NSDate.distantFuture,
    );
} finally {
  workspace.removeObserver(observer);
  center.removeObserver(observer);
}
