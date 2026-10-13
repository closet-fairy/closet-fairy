import type { LinkProps } from '@tanstack/react-router';
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

const BottomTabBar = () => {
  return (
    <S.Container aria-label="주요 메뉴">
      <S.List>
        {TABS.map((tab) => (
          <S.Item key={tab.to}>
            <S.TabLink to={tab.to}>
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
