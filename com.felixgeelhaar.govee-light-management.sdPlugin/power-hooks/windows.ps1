# Native Windows session events. Uses the installed Windows PowerShell/.NET runtime.
# No API key, light identifiers, execution-policy change or elevated service.
$ErrorActionPreference = 'Stop'
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @'
using System;
using System.Threading;
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
