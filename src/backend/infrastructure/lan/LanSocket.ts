import { createSocket, type Socket } from "node:dgram";
import { LAN_LISTEN_PORT, LAN_MULTICAST_ADDRESS } from "./LanProtocol";

/** The only seam that touches UDP; tests use a fake. */
export interface LanSocketPort {
  open(onMessage: (message: string, from: string) => void): Promise<void>;
  send(message: string, host: string, port: number): Promise<void>;
  close(): void;
}

/** Listens on the Govee reply port and joins the scan multicast group. */
export class DgramLanSocket implements LanSocketPort {
  private socket?: Socket;

  open(onMessage: (message: string, from: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      // reuseAddr lets the plugin share the port with another Govee
      // integration on the same machine where the OS allows it.
      const socket = createSocket({ type: "udp4", reuseAddr: true });
      const fail = (error: Error) => {
        socket.close();
        reject(error);
      };
      socket.once("error", fail);
      socket.bind(LAN_LISTEN_PORT, () => {
        socket.off("error", fail);
        try {
          socket.addMembership(LAN_MULTICAST_ADDRESS);
        } catch {
          // Unicast replies still arrive; only multicast echoes are lost.
        }
        // A runtime socket error must not crash the plugin; sends report
        // their own failures.
        socket.on("error", () => undefined);
        socket.on("message", (data, remote) =>
          onMessage(data.toString("utf8"), remote.address),
        );
        this.socket = socket;
        resolve();
      });
    });
  }

  send(message: string, host: string, port: number): Promise<void> {
    const socket = this.socket;
    if (!socket) return Promise.reject(new Error("LAN socket is not open"));
    return new Promise((resolve, reject) =>
      socket.send(message, port, host, (error) =>
        error ? reject(error) : resolve(),
      ),
    );
  }

  close(): void {
    this.socket?.close();
    this.socket = undefined;
  }
}
