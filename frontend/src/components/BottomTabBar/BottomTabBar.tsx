import { useQueryClient } from '@tanstack/react-query';
import type { LinkProps } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { IconName } from '@/assets/icons';
import Icon from '@/components/common/Icon';
import * as S from './BottomTabBar.styled';

interface Tab {
  to: LinkProps['to'];
  label: string;
  icon: IconName;
  activeIcon: IconName;
}

const TABS: Tab[] = [
  {
    to: '/closet',
    label: '옷장',
    icon: 'checkroom',
    activeIcon: 'checkroom-fill',
  },
  {
    to: '/recommendation',
    label: '추천',
    icon: 'star_shine',
    activeIcon: 'star_shine-fill',
  },
  {
    to: '/recommendation-history',
    label: '추천 내역',
    icon: 'history',
    activeIcon: 'history-fill',
  },
  {
    to: '/my-info',
    label: '내 정보',
    icon: 'person',
    activeIcon: 'person-fill',
  },
];

const SETTLE_CHECK_INTERVAL_MS = 1000;
const MAX_SETTLE_CHECKS = 5;

const hasLoadingImage = () =>
  Array.from(document.images).some((image) => {
    if (image.complete) {
      return false;
    }

    if (image.loading !== 'lazy') {
      return true;
    }

    const { top, bottom } = image.getBoundingClientRect();

    return bottom > 0 && top < window.innerHeight;
  });

const useIsLoadSettled = () => {
  const queryClient = useQueryClient();
  const [isSettled, setIsSettled] = useState(false);

  useEffect(() => {
    let timerId: number | undefined;
    let checkCount = 0;

    const check = () => {
      checkCount += 1;

      if (
        checkCount < MAX_SETTLE_CHECKS &&
        (queryClient.isFetching() > 0 || hasLoadingImage())
      ) {
        timerId = window.setTimeout(check, SETTLE_CHECK_INTERVAL_MS);
        return;
      }

      setIsSettled(true);
    };

    timerId = window.setTimeout(check, SETTLE_CHECK_INTERVAL_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [queryClient]);

  return isSettled;
};

const BottomTabBar = () => {
  const isLoadSettled = useIsLoadSettled();

  return (
    <S.Container aria-label="주요 메뉴">
      <S.List>
        {TABS.map((tab) => (
          <S.Item key={tab.to}>
            <S.TabLink to={tab.to} preload={isLoadSettled ? 'render' : false}>
              {({ isActive }) => (
                <>
                  <Icon name={isActive ? tab.activeIcon : tab.icon} size="lg" />
                  <S.Label $isActive={isActive}>{tab.label}</S.Label>
                </>
              )}
            </S.TabLink>
          </S.Item>
        ))}
      </S.List>
    </S.Container>
  );
};

export default BottomTabBar;
