# Offline-hint group power regression (#311)

Failing action tests reproduced a remaining gate: offline-flagged members were
excluded from power sampling, so an already-on group could Toggle On again
instead of Off. Group counts and dial values also showed Off. Samplers now read
all members, keep full denominators and retain known power on unavailable reads.
Online hints only inform cache refresh. Model mismatch is diagnosed separately;
saved IDs/models are not silently changed.

## Manual verification (macOS and Windows)

1. Create a group of two cloud-connected lights and turn both on in Govee Home.
2. Press an On/Off Toggle key: both should receive Off. Press again for On.
   Repeat using brightness dial press/touch. Check counts 2/2, 0/2 and 1/2.
3. Repeat with cloud online hints false if that condition occurs. Inspect the
   group request log: attemptedCount stays full even if controllableCount is smaller.
4. Test hybrid/legacy brightness, color, temperature, segment and saturation dials;
   bars/values should retain normal behavior. Recall a scene/snapshot too.
5. Make one member unreachable. Successful commands must survive, with the existing
   partial-failure warning. Failed reads must retain known state.
6. Test native titles and separate power artwork alongside the other draft fixes.
7. Capture sanitized model-mismatch resolveTarget lines, reselect the correct
   light, and confirm settings/groups/UUIDs remain intact.

Automated regressions use actual action handlers with mocked SDK/API boundaries,
including snapshot ID 0. No real Stream Deck/Govee control was tested. These group
fixes do not establish resolution of the reporter's remaining individual-light
problem; current sanitized logs and Wi-Fi/cloud confirmation are still needed.
