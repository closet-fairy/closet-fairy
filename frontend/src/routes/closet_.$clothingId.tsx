import { createFileRoute, notFound } from '@tanstack/react-router';
import { z } from 'zod';
import ClothingDetailPage from '@/pages/ClothingDetail';

const paramsSchema = z.object({
  clothingId: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.int()),
});

export const Route = createFileRoute('/closet_/$clothingId')({
  params: {
    parse: (params) => {
      const result = paramsSchema.safeParse(params);

      if (!result.success) {
        throw notFound();
      }

      return result.data;
    },
    stringify: (params) => ({ clothingId: String(params.clothingId) }),
  },
  staticData: { isFullScreen: true },
  component: ClothingDetailPage,
});
