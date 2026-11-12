# Native Windows session events. Uses the installed Windows PowerShell/.NET runtime.
# No API key, light identifiers, execution-policy change or elevated service.
$ErrorActionPreference = 'Stop'
Add-Type -ReferencedAssemblies System.Management, System.Windows.Forms -TypeDefinition @'
using System;
using System.Management;
using System.Threading;
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
        // On an STA thread SystemEvents puts its hidden window on this thread,
        // so this thread must pump messages; blocking it drops every event.
        SystemEvents.PowerModeChanged += power;
        SystemEvents.SessionEnding += session;
        // Parent pipe closure also terminates the helper after a plugin crash.
        Thread parent = new Thread(delegate() {
            try { while (Console.In.ReadLine() != null) {} } catch (Exception) {}
            // Ask the message loop to end so the process exits normally; the
            // hard exit is the backstop if something keeps it alive.
            System.Windows.Forms.Application.Exit();
            Thread.Sleep(400);
            Environment.Exit(0);
        });
        parent.IsBackground = true;
        Emit("ready");
        parent.Start();
        System.Windows.Forms.Application.Run();
    }
}
'@
[GoveePowerObserver]::Run()
