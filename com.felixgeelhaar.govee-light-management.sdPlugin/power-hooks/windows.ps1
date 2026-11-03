# Native Windows session events. Uses the installed Windows PowerShell/.NET runtime.
# No API key, light identifiers, execution-policy change or elevated service.
$ErrorActionPreference = 'Stop'
Add-Type -ReferencedAssemblies System.Management -TypeDefinition @'
using System;
using System.Management;
using Microsoft.Win32;
public static class GoveePowerObserver {
    private static readonly object Gate = new object();
    private static bool sleeping;
    private static DateTime lastWake = DateTime.MinValue;
    private static void Emit(string value) {
        lock (Gate) {
            // Two independent sources report the same transitions; pass each once.
            if (value == "sleep") { if (sleeping) return; sleeping = true; }
            // A wake without a seen sleep is still real: that is the missed-Suspend case.
            if (value == "wake") {
                if ((DateTime.UtcNow - lastWake).TotalSeconds < 3) return;
                lastWake = DateTime.UtcNow;
                sleeping = false;
            }
            Console.Out.WriteLine(value);
            Console.Out.Flush();
        }
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
        // Some desktops never raise PowerModes.Suspend; WMI reports it separately.
        ManagementEventWatcher wmi = null;
        try {
            wmi = new ManagementEventWatcher(new WqlEventQuery("SELECT * FROM Win32_PowerManagementEvent"));
            wmi.EventArrived += delegate(object sender, EventArrivedEventArgs args) {
                int type = Convert.ToInt32(args.NewEvent["EventType"]);
                if (type == 4) Emit("sleep");
                if (type == 7 || type == 18) Emit("wake");
            };
            wmi.Start();
        } catch (Exception) {
            wmi = null;
        }
        SystemEvents.PowerModeChanged += power;
        SystemEvents.SessionEnding += session;
        try {
            Emit("ready");
            // Parent pipe closure also terminates the helper after a plugin crash.
            while (Console.ReadLine() != null) {}
        } finally {
            if (wmi != null) { try { wmi.Stop(); wmi.Dispose(); } catch (Exception) {} }
            SystemEvents.PowerModeChanged -= power;
            SystemEvents.SessionEnding -= session;
        }
    }
}
'@
[GoveePowerObserver]::Run()
