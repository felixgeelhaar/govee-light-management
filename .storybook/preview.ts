import type { Preview } from '@storybook/vue3-vite';
import '../src/frontend/styles/property-inspector.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'stream-deck-dark',
      values: [
        {
          name: 'stream-deck-dark',
          value: '#2d2d30',
        },
        {
          name: 'stream-deck-light',
          value: '#3c3c3c',
        },
        {
          name: 'white',
          value: '#ffffff',
        },
      ],
    },
  },
};

export default preview;
