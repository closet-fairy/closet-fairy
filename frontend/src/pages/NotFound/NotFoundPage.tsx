import { useNavigate } from '@tanstack/react-router';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import StatusView from '@/components/common/StatusView';
import TopBar from '@/components/common/TopBar';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <>
      <TopBar />
      <StatusView
        visual={<Icon name="search_off" size="2xl" />}
        title="페이지를 찾을 수 없어요"
        description="주소가 잘못되었거나 없어진 페이지예요."
        actions={
          <Button
            isFullWidth
            onClick={() => void navigate({ to: '/closet', replace: true })}
          >
            옷장으로 가기
          </Button>
        }
      />
    </>
  );
};

export default NotFoundPage;
