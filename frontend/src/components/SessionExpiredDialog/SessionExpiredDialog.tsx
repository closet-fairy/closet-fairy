import { useState, useSyncExternalStore } from 'react';
import {
  getIsSessionExpired,
  subscribeSessionExpiry,
} from '@/apis/authSession';
import Button from '@/components/common/Button';
import Dialog from '@/components/common/Dialog';
import useEndSession from '@/hooks/useEndSession';

const SessionExpiredDialog = () => {
  const isExpired = useSyncExternalStore(
    subscribeSessionExpiry,
    getIsSessionExpired,
  );
  const endSession = useEndSession();
  const [isLeaving, setIsLeaving] = useState(false);

  const handleSignInAgain = async () => {
    setIsLeaving(true);

    try {
      await endSession();
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <Dialog
      isOpen={isExpired}
      onOpenChange={() => {}}
      isDismissable={false}
      title="로그인이 만료되었어요"
      description="보안을 위해 일정 시간이 지나면 다시 로그인해야 합니다."
      footer={
        <Button
          isFullWidth
          isLoading={isLeaving}
          onClick={() => void handleSignInAgain()}
        >
          다시 로그인
        </Button>
      }
    />
  );
};

export default SessionExpiredDialog;
