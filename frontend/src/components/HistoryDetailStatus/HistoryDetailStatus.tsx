import { isClientError, isNotFoundError } from '@/apis/apiError';
import { isUnauthorizedError } from '@/apis/authSession';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import StatusView from '@/components/common/StatusView';
import OutfitLoading from '@/components/OutfitLoading';

interface HistoryDetailStatusProps {
  error: Error | null;
  isRetrying: boolean;
  onRetry: () => void;
  onGoToList: () => void;
}

const HistoryDetailStatus = (props: HistoryDetailStatusProps) => {
  const { error, isRetrying, onRetry, onGoToList } = props;

  if (isNotFoundError(error)) {
    return (
      <StatusView
        visual={<Icon name="search_off" size="2xl" />}
        title="내역을 찾을 수 없어요"
        description="없거나 볼 수 없는 내역이에요."
        actions={
          <Button isFullWidth onClick={onGoToList}>
            추천 내역으로 가기
          </Button>
        }
      />
    );
  }

  // 로그인이 만료되면 전역 다이얼로그가 안내하므로, 그 뒤에 실패 화면을 겹치지 않고 로딩 화면을 둔다.
  if (error !== null && !isUnauthorizedError(error)) {
    return (
      <StatusView
        visual={<Icon name="error" size="2xl" />}
        title="코디를 불러오지 못했어요"
        description={error.message}
        actions={
          !isClientError(error) && (
            <Button
              icon="refresh"
              isFullWidth
              isLoading={isRetrying}
              onClick={onRetry}
            >
              다시 시도
            </Button>
          )
        }
      />
    );
  }

  return <OutfitLoading />;
};

export default HistoryDetailStatus;
