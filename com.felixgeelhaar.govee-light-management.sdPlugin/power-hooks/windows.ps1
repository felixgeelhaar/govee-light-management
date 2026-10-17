# Native Windows session events. Uses the installed Windows PowerShell/.NET runtime.
# No API key, light identifiers, execution-policy change or elevated service.
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using Microsoft.Win32;
public static class GoveePowerObserver {
    private static void Emit(string value) {
        Console.Out.WriteLine(value);
        Console.Out.Flush();
    }
    public static void Run() {
        PowerModeChangedEventHandler power = delegate(object sender, PowerModeChangedEventArgs args) {
            if (args.Mode == PowerModes.Suspend) Emit("sleep");
            if (args.Mode == PowerModes.Resume) Emit("wake");
        };
        SessionEndingEventHandler session = delegate(object sender, SessionEndingEventArgs args) {
            Emit("shutdown");
            // Never cancel or delay the OS session transition.
        };
        SystemEvents.PowerModeChanged += power;
        SystemEvents.SessionEnding += session;
        try {
            Emit("ready");
            // Parent pipe closure also terminates the helper after a plugin crash.
            while (Console.ReadLine() != null) {}
        } finally {
            SystemEvents.PowerModeChanged -= power;
            SystemEvents.SessionEnding -= session;
        }
    }
}
'@
[GoveePowerObserver]::Run()
