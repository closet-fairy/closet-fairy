import { Global } from '@emotion/react';
import type { Decorator, Preview } from '@storybook/react-vite';
import { mswLoader } from 'msw-storybook-addon/csf3';
import { INITIAL_VIEWPORTS } from 'storybook/viewport';
import { warnOnUnhandledApiRequest, worker } from '@/mocks/browser';
import { globalStyles } from '@/styles/globalStyles';
import StoryQueryClientProvider from './StoryQueryClientProvider';
import StoryRouterProvider from './StoryRouterProvider';
import 'wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.css';

const withGlobalStyles: Decorator = (Story) => (
  <>
    <Global styles={globalStyles} />
    <Story />
  </>
);

const withQueryClient: Decorator = (Story) => (
  <StoryQueryClientProvider>
    <Story />
  </StoryQueryClientProvider>
);

const withRouter: Decorator = (Story) => (
  <StoryRouterProvider>
    <Story />
  </StoryRouterProvider>
);

const preview: Preview = {
  tags: ['autodocs'],
  decorators: [withRouter, withQueryClient, withGlobalStyles],
  loaders: [
    mswLoader(async () => {
      await worker.start({
        quiet: true,
        onUnhandledRequest: warnOnUnhandledApiRequest,
      });

      return worker;
    }),
  ],
  parameters: {
    viewport: { options: INITIAL_VIEWPORTS },
  },
  initialGlobals: {
    viewport: { value: 'iphone14', isRotated: false },
  },
};

export default preview;
