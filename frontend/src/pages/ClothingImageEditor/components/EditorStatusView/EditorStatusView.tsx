import type { ReactNode } from 'react';
import IconButton from '@/components/common/IconButton';
import StatusView from '@/components/common/StatusView';
import TopBar from '@/components/common/TopBar';
import * as S from './EditorStatusView.styled';

interface EditorStatusViewProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  onClose: () => void;
}

const EditorStatusView = (props: EditorStatusViewProps) => {
  const { title, description, actions, onClose } = props;

  return (
    <S.Container>
      <TopBar
        title="이미지 편집"
        leading={
          <IconButton icon="close" aria-label="닫기" onClick={onClose} />
        }
      />
      <S.Body>
        {title !== undefined && (
          <StatusView
            title={title}
            description={description}
            actions={actions}
          />
        )}
      </S.Body>
    </S.Container>
  );
};

export default EditorStatusView;
