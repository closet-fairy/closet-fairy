import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import MyInfoPage from '@/pages/MyInfo';

const searchSchema = z.object({
  withdraw_error: z.string().optional().catch(undefined),
});

export const Route = createFileRoute('/my-info')({
  validateSearch: searchSchema,
  component: MyInfoPage,
});
