// Minimal SDPI Components stub for testing
// This provides basic functionality for UI tests without the full Stream Deck integration

window.SDPI = {
  // Mock Stream Deck PI interface
  sendToPlugin: function(payload) {
    console.log('Mock SDPI: sendToPlugin called with:', payload);
    // Simulate async response for testing
    setTimeout(() => {
      if (payload.event === 'fetchLights') {
        // Mock successful light fetch
        const mockEvent = {
          source: 'plugin',
          payload: {
            event: 'lightsReceived',
            lights: [
              { deviceId: 'device123', model: 'H6110', name: 'Test Light 1' },
              { deviceId: 'device456', model: 'H6159', name: 'Test Light 2' }
            ]
          }
        };
        window.dispatchEvent(new CustomEvent('message', { detail: mockEvent }));
      }
    }, 100);
  },
  
  getSettings: function() {
    return {};
  },
  
  setSettings: function(settings) {
    console.log('Mock SDPI: setSettings called with:', settings);
  }
};

// Mock global connectElgatoStreamDeckSocket function
window.connectElgatoStreamDeckSocket = function(port, pi, uuid, info, actionInfo) {
  console.log('Mock connectElgatoStreamDeckSocket called');
  return {
    send: function(data) {
      console.log('Mock websocket send:', data);
    }
  };
};

// Add basic form validation for testing
document.addEventListener('DOMContentLoaded', function() {
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      
      // Basic validation
      const requiredFields = form.querySelectorAll('[required]');
      let hasErrors = false;
      
      requiredFields.forEach(field => {
        const errorElement = document.querySelector(`#${field.name}Error`);
        if (!field.value) {
          hasErrors = true;
          if (errorElement) {
            errorElement.textContent = `${field.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} is required`;
          }
        } else if (errorElement) {
          errorElement.textContent = '';
        }
      });
      
      if (!hasErrors) {
        console.log('Form validation passed');
      }
    });
  });
});