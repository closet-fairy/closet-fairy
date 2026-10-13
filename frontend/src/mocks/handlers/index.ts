import type { RequestHandler } from 'msw';
import { recommendationHandlers } from './recommendation';

export const handlers: RequestHandler[] = [...recommendationHandlers];
