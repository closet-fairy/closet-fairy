import type { RequestHandler } from 'msw';
import { clothingHandlers } from './clothing';
import { memberHandlers } from './member';
import { recommendationHandlers } from './recommendation';
import { regionHandlers } from './region';
import { weatherHandlers } from './weather';

export const handlers: RequestHandler[] = [
  ...clothingHandlers,
  ...memberHandlers,
  ...recommendationHandlers,
  ...regionHandlers,
  ...weatherHandlers,
];
