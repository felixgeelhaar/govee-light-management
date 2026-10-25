# LAN control: design plan

Status: accepted, 2026-10-25. Phases 1–3 implemented (#405, #406, phase 3 PR).

## Goal

Send the common light commands to Govee lights over the local network when a
light allows it, and use the cloud API otherwise. The user gets faster keys
and dials, fewer cloud requests, and those commands keep working when the
internet is down. There is no new setting: the plugin uses LAN when it works
and the cloud when it doesn't.

## What Govee's LAN API covers

The protocol is UDP and has to be switched on per light in the Govee app
(device settings → **LAN Control**; the toggle can take a few minutes to
appear).

| Purpose | Message | Address |
| --- | --- | --- |
| Discover | `{"msg":{"cmd":"scan","data":{"account_topic":"reserve"}}}` | multicast `239.255.255.250:4001` |
| Discovery reply | `scan` with `ip`, `device` (same id as the cloud API), `sku` | to the plugin on UDP `4002` |
| Read state | `{"msg":{"cmd":"devStatus","data":{}}}` → `onOff`, `brightness`, `color`, `colorTemInKelvin` | device `ip:4003`; reply on `4002` |
| Power | `turn` with `value` 0/1 | device `ip:4003` |
| Brightness | `brightness` with `value` 1–100 | device `ip:4003` |
| Colour / temperature | `colorwc` with `color {r,g,b}` and `colorTemInKelvin` | device `ip:4003` |

Commands get no acknowledgement. Only a follow-up `devStatus` confirms them.

**Not covered:** segment colours, dynamic and DIY scenes, snapshots, music
mode and feature toggles. Those stay on the cloud API. Some community
projects send them through an undocumented `ptReal` command carrying raw
Bluetooth packets. That is reverse-engineered, model-specific and can break
with firmware updates, so it is out of scope here; see the last phase.

This means **LAN does not speed up custom effects**, because they are
segment colours. It does speed up On/Off, Brightness, Color and Color
Temperature keys and dials, group fan-out of those commands, and live state
reads.

**Models:** Govee publishes a list of LAN-capable models. Community lists
include the H6056 (your Desk) but not the H61B5 or the H600D bulbs. The
scan reply is the real test: a light that answers can use LAN.

## How it fits the code

Discovery uses `TransportOrchestrator`. Commands and state reads don't: they
go `ActionServices` → `GoveeLightRepository` → `GoveeClient`. So LAN belongs
at the repository boundary:

```
ActionServices
  └─ ILightRepository  ← LanFirstLightRepository (new, decorator)
        ├─ LanLightChannel        power, brightness, colour, kelvin, state
        │     └─ LanDeviceRegistry   deviceId → ip, last seen
        └─ GoveeLightRepository   everything else, and any LAN failure
```

- **`infrastructure/lan/LanSocket`** wraps Node `dgram`. It binds `4002`,
  joins the multicast group, and sends to `4001` and `4003`. It's the only
  file that touches UDP, and tests use a fake.
- **`LanDeviceRegistry`**: scans at startup and on each inventory refresh,
  so at most every 10 minutes when idle, and immediately when a command
  misses. It maps the scan's `device` to the cloud `deviceId`. An entry
  expires if the light stops answering.
- **`LanLightChannel`**: one method per supported command, plus
  `devStatus` with a short timeout (about 500 ms). It maps to and from the
  domain value objects (`Brightness`, `ColorRgb`, `ColorTemperature`).
- **`LanFirstLightRepository implements ILightRepository`**: for the four
  supported commands and `getLightState`, it uses LAN when the registry
  knows the light. Otherwise, or on a timeout or socket error, it calls
  `GoveeLightRepository`. Every other method delegates to the cloud
  unchanged. The domain and the actions don't change.
- **Confirmation:** after a LAN command, read `devStatus` once. If it
  doesn't show the change, resend over the cloud and mark the light
  "LAN unreliable" for the session. This keeps the existing per-command
  logging honest (`light.command` gains `transport: "lan" | "cloud"`).
- **Groups:** `fanOutToLights` already applies per member, so each member
  takes whichever path it has.
- **State polling:** LAN reads don't count against the cloud rate limit, so
  lights on LAN can sync every 3–5 s while the cloud cadence stays as is.

## User-visible behaviour

- No new control. The "What this light supports" panel shows
  `Connection: LAN` or `Connection: Cloud`, and for cloud lights a hint to
  turn on LAN Control in the Govee app if the model supports it.
- **macOS:** the first scan triggers the system **Local Network** permission
  prompt, attributed to Stream Deck. If it's denied, scans see nothing and
  everything stays on the cloud. Document this in the README.
- **Windows:** the firewall may prompt for Node on first use. If it's
  blocked, the result is the same.
- **Port conflicts:** another app (Home Assistant, Homebridge or govee2mqtt
  on the same machine) may already hold UDP `4002`. Then LAN is disabled
  for the session with one log line, and everything works over the cloud.

## Phases

Each phase can ship on its own.

1. **Discovery only.** Socket, registry, a `lan.discover` log line, and
   the Connection line in the metadata panel. This proves on real hardware
   which lights answer, the macOS permission and port behaviour, and the
   id mapping, before any command depends on it.
2. **State reads over LAN** for lights in the registry, falling back to
   cloud. It's low risk and immediately reduces cloud traffic.
3. **Commands over LAN** (power, brightness, colour, kelvin), with
   confirmation and cloud fallback, for keys, dials, groups, Automation and
   Schedule.
4. **Optional research, not committed:** `ptReal` segment colours for
   custom effects, limited to models verified on hardware. Decide after
   phase 3 based on demand.

## Tests

- Unit: registry mapping and expiry; message encoding and decoding;
  timeout and fallback paths; confirmation mismatch resending over the
  cloud; port-in-use disabling LAN. All of this runs against a fake
  socket, with no network in CI.
- Hardware (macOS, Stream Deck +): Desk H6056 with LAN Control on and off;
  Local Network permission denied; another process holding `4002`; Wi-Fi
  off while the cloud is reachable, and the reverse.

## Decisions

1. **LAN is on by default, with no setting.** The plugin uses LAN when a
   light answers and the cloud otherwise.
2. **The macOS Local Network prompt is accepted.** The website documents
   how to grant access again after denying it (System Settings → Privacy &
   Security → Local Network → Stream Deck), along with the Windows firewall
   equivalent and turning on LAN Control in the Govee app.

## Sources

- Govee WLAN guide: https://app-h5.govee.com/user-manual/wlan-guide
- openHAB Govee LAN binding (ports, enabling LAN, model list):
  https://www.openhab.org/addons/bindings/govee/
- homebridge-govee LAN connection (scan / devStatus messages, timing):
  https://app.unpkg.com/homebridge-govee@10.15.0/files/lib/connection/lan.js
- homebridge-govee LAN Control wiki:
  https://github.com/homebridge-plugins/homebridge-govee/wiki/LAN-Control
