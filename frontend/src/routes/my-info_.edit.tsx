import { createFileRoute } from '@tanstack/react-router';
import ProfileEditPage from '@/pages/ProfileEdit';

export const Route = createFileRoute('/my-info_/edit')({
  staticData: { isFullScreen: true },
  component: ProfileEditPage,
});
