// SDPI Components v4.0.1 - Stream Deck Property Inspector Components
// BSD-3-Clause License
// This is a minified build of the SDPI Components library for local use
// For development, use the remote version from https://sdpi-components.dev/releases/v4/sdpi-components.js

// Note: This is a placeholder - the actual minified library should be downloaded from the URL above
// For now, we'll implement a basic custom SDPI framework following the official patterns

class SDPIComponents {
    static init() {
        console.log('SDPI Components initialized (local fallback)');
        // Initialize Stream Deck connection if not already done
        if (typeof connectElgatoStreamDeckSocket === 'undefined') {
            window.connectElgatoStreamDeckSocket = this.connectSocket;
        }
    }

    static connectSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
        const uuid = inUUID;
        const actionInfo = JSON.parse(inActionInfo);
        const settings = actionInfo.payload.settings || {};
        
        const websocket = new WebSocket('ws://localhost:' + inPort);
        
        websocket.onopen = function() {
            const registerEvent = {
                event: inRegisterEvent,
                uuid: uuid
            };
            websocket.send(JSON.stringify(registerEvent));
        };

        // Store connection info globally for components to use
        window.streamDeckConnection = {
            websocket,
            uuid,
            settings,
            send: function(payload) {
                if (websocket.readyState === 1) {
                    websocket.send(JSON.stringify(payload));
                }
            }
        };

        return websocket;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => SDPIComponents.init());
} else {
    SDPIComponents.init();
}