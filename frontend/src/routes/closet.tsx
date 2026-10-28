import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import ClosetPage from '@/pages/Closet';

const searchSchema = z.object({
  register: z.boolean().optional().catch(undefined),
});

export const Route = createFileRoute('/closet')({
  validateSearch: searchSchema,
  component: ClosetPage,
});
