import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PowerEventSource } from "../../services/PowerLifecycleService";
import type { PowerEvent } from "../../../shared/power-lifecycle";

function hookDirectory(): string {
  const directory = dirname(fileURLToPath(import.meta.url));
  // Bundles live in bin/. Missing packaged resources fail closed rather
  // than searching arbitrary working-directory scripts.
  return basename(directory) === "bin"
    ? join(directory, "..", "power-hooks")
    : join(
        process.cwd(),
        "com.felixgeelhaar.govee-light-management.sdPlugin",
        "power-hooks",
      );
}

/** One opt-in child per plugin. Stdout is a bounded, whitelisted event protocol. */
export class NativePowerEvents implements PowerEventSource {
  private child?: ChildProcess;
  private finishStart?: (error: Error) => void;
  private killTimers = new Set<ReturnType<typeof setTimeout>>();
  constructor(
    private readonly options: {
      platform?: NodeJS.Platform;
      spawn?: typeof spawn;
      directory?: string;
    } = {},
  ) {}

  start(
    onEvent: (event: PowerEvent) => void,
    onFailure: () => void,
  ): Promise<void> {
    this.stop();
    const platform = this.options.platform ?? process.platform;
    if (platform !== "darwin" && platform !== "win32")
      return Promise.reject(new Error("Native power hooks unavailable"));
    const directory = this.options.directory ?? hookDirectory();
    return new Promise((resolve, reject) => {
      let ready = false;
      let finished = false;
      let buffer = "";
      const fail = () => {
        if (finished) return;
        finished = true;
        clearTimeout(startup);
        reject(new Error("Native power hook unavailable"));
        onFailure();
        this.stop();
      };
      const startup = setTimeout(fail, 30000);
      this.finishStart = () => {
        if (!ready) {
          clearTimeout(startup);
          reject(new Error("Native power hook stopped"));
        }
      };
      let child: ChildProcess;
      try {
        const command =
          platform === "darwin"
            ? "/usr/bin/osascript"
            : join(
                process.env.SystemRoot ?? "C:\\Windows",
                "System32",
                "WindowsPowerShell",
                "v1.0",
                "powershell.exe",
              );
        const args =
          platform === "darwin"
            ? ["-l", "JavaScript", join(directory, "macos.js")]
            : [
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                readFileSync(join(directory, "windows.ps1"), "utf8"),
              ];
        child = (this.options.spawn ?? spawn)(command, args, {
          shell: false,
          windowsHide: true,
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch {
        fail();
        return;
      }
      this.child = child;
      child.stdout?.setEncoding("utf8");
      child.stdout?.on("data", (chunk: string) => {
        if (this.child !== child || finished) return;
        buffer += chunk;
        if (buffer.length > 1024) {
          fail();
          return;
        }
        let end: number;
        while ((end = buffer.indexOf("\n")) >= 0) {
          const event = buffer.slice(0, end).trim();
          buffer = buffer.slice(end + 1);
          if (event === "ready" && !ready) {
            ready = true;
            clearTimeout(startup);
            this.finishStart = undefined;
            resolve();
          } else if (ready && ["wake", "sleep", "shutdown"].includes(event))
            onEvent(event as PowerEvent);
        }
      });
      // Drain diagnostics without forwarding potentially sensitive OS/user paths.
      child.stderr?.on("data", () => {});
      child.stdin?.on("error", () => {});
      child.once("error", fail);
      child.once("exit", () => {
        if (this.child === child) fail();
      });
    });
  }

  stop(): void {
    this.finishStart?.(new Error("stopped"));
    this.finishStart = undefined;
    const child = this.child;
    this.child = undefined;
    if (!child) return;
    child.stdin?.end();
    const timer = setTimeout(() => {
      this.killTimers.delete(timer);
      child.kill("SIGKILL");
    }, 1000);
    this.killTimers.add(timer);
    if (typeof timer === "object" && "unref" in timer) timer.unref();
    child.once("exit", () => {
      clearTimeout(timer);
      this.killTimers.delete(timer);
    });
  }
}
