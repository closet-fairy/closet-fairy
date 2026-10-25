import { useId, useState } from 'react';
import { isUnauthorizedError } from '@/apis/authSession';
import type { IconName } from '@/assets/icons';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import IconButton from '@/components/common/IconButton';
import TextField from '@/components/common/TextField';
import TopBar from '@/components/common/TopBar';
import { PROVIDER_LABEL } from '@/domains/member/memberSettingOptions';
import {
  isWithdrawalConfirmed,
  WITHDRAWAL_CONFIRM_PHRASE,
} from '@/domains/member/withdrawalConfirm';
import { useStartWithdrawalAuthWithdrawPost } from '@/generated/endpoints/auth/auth';
import { useGetMeMembersMeGet } from '@/generated/endpoints/member/member';
import useGoBack from '@/hooks/useGoBack';
import useRedirectLock from '@/hooks/useRedirectLock';
import * as S from './WithdrawalPage.styled';

const START_ERROR_MESSAGE = '탈퇴를 시작하지 못했어요. 다시 시도해 주세요.';

interface DeletedRecord {
  icon: IconName;
  label: string;
}

const DELETED_RECORDS: DeletedRecord[] = [
  { icon: 'checkroom', label: '등록한 옷과 사진' },
  { icon: 'history', label: '추천 내역과 별점 기록' },
  { icon: 'person', label: '체질·성별·선호 스타일 설정' },
];

const WithdrawalPage = () => {
  const goBack = useGoBack();
  const phraseInputId = useId();
  const { data: me } = useGetMeMembersMeGet();
  const startWithdrawal = useStartWithdrawalAuthWithdrawPost();
  const [phrase, setPhrase] = useState('');
  const { isRedirecting, redirect } = useRedirectLock();
  const isConfirmed = isWithdrawalConfirmed(phrase);
  const isBusy = startWithdrawal.isPending || isRedirecting;
  const hasError =
    startWithdrawal.isError && !isUnauthorizedError(startWithdrawal.error);

  const handleWithdraw = () => {
    startWithdrawal.mutate(undefined, {
      onSuccess: ({ authorize_url: authorizeUrl }) => {
        redirect(authorizeUrl);
      },
    });
  };

  return (
    <S.Container>
      <TopBar
        title="회원 탈퇴"
        leading={
          <IconButton
            icon="arrow_back"
            aria-label="뒤로 가기"
            isDisabled={isBusy}
            onClick={goBack}
          />
        }
      />
      <S.Body>
        <S.Intro>
          <S.Heading>회원 탈퇴</S.Heading>
          <S.Message>
            정말 <strong>옷장요정</strong>에서 탈퇴하시겠어요?
            <br />
            탈퇴 시 아래의 기록들이 모두 제거되며, 되돌릴 수 없게 됩니다.
          </S.Message>
        </S.Intro>
        <S.RecordList>
          {DELETED_RECORDS.map((record) => (
            <S.Record key={record.label}>
              <Icon name={record.icon} size="md" />
              {record.label}
            </S.Record>
          ))}
        </S.RecordList>
        <S.Confirm>
          <S.ConfirmLabel htmlFor={phraseInputId}>
            탈퇴에 동의하시는 경우, <strong>{WITHDRAWAL_CONFIRM_PHRASE}</strong>
            를 입력해 주세요.
          </S.ConfirmLabel>
          <TextField
            id={phraseInputId}
            value={phrase}
            onChange={setPhrase}
            placeholder={WITHDRAWAL_CONFIRM_PHRASE}
            autoComplete="off"
            enterKeyHint="done"
            isDisabled={isBusy}
          />
          {me && (
            <S.Guide>
              [탈퇴하기]를 누르면 가입한 {PROVIDER_LABEL[me.provider_cd]}{' '}
              계정으로 다시 로그인해 본인을 확인해요.
            </S.Guide>
          )}
        </S.Confirm>
      </S.Body>
      <S.Footer>
        {hasError && (
          <S.ErrorMessage role="alert">
            <Icon name="error" size="sm" />
            {START_ERROR_MESSAGE}
          </S.ErrorMessage>
        )}
        <Button
          variant="outline"
          isFullWidth
          isDisabled={!isConfirmed}
          isLoading={isBusy}
          onClick={handleWithdraw}
        >
          탈퇴하기
        </Button>
        <Button
          variant="text"
          size="md"
          isFullWidth
          isDisabled={isBusy}
          onClick={goBack}
        >
          돌아가기
        </Button>
      </S.Footer>
    </S.Container>
  );
};

export default WithdrawalPage;
