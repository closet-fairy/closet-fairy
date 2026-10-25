import { useNavigate } from '@tanstack/react-router';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import StatusView from '@/components/common/StatusView';

const RecommendationResultPage = () => {
  const navigate = useNavigate();

  return (
    <StatusView
      visual={<Icon name="check_circle-fill" size="xl" />}
      title="추천 완료!"
      description="결과 화면은 준비 중이에요."
      actions={
        <Button
          variant="outline"
          isFullWidth
          onClick={() => void navigate({ to: '/recommendation' })}
        >
          다시 추천받기
        </Button>
      }
    />
  );
};

export default RecommendationResultPage;
