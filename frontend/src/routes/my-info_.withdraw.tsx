import { createFileRoute } from '@tanstack/react-router';
import WithdrawalPage from '@/pages/Withdrawal';

export const Route = createFileRoute('/my-info_/withdraw')({
  staticData: { isFullScreen: true },
  component: WithdrawalPage,
});
