import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import LoginPage from '@/pages/Login';

const searchSchema = z.object({
  error: z.string().optional().catch(undefined),
  withdrawn: z.coerce.number().optional().catch(undefined),
});

export const Route = createFileRoute('/login')({
  validateSearch: searchSchema,
  staticData: { isFullScreen: true },
  component: LoginPage,
});
