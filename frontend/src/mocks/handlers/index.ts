import type { RequestHandler } from 'msw';
import { clothingHandlers } from './clothing';
import { recommendationHandlers } from './recommendation';

export const handlers: RequestHandler[] = [
  ...clothingHandlers,
  ...recommendationHandlers,
];
