import type { RefObject } from 'react';
import BottomSheet from '@/components/common/BottomSheet';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import Tag from '@/components/common/Tag';
import OutfitItemImage from '@/components/OutfitItemImage';
import { WEATHER_CONDITION_ICONS } from '@/constants/weatherConditionIcon';
import { getStyleLabel } from '@/domains/member/memberSettingOptions';
import { getOutfitStyleTags } from '@/domains/recommendation/outfitStyleTags';
import { getWeatherLabel } from '@/domains/recommendation/weatherSummary';
import type { OutfitResult, RecommendationResult } from '@/generated/models';
import * as S from './OutfitInfoSheet.styled';

interface OutfitInfoSheetProps {
  outfit: OutfitResult;
  weather: RecommendationResult['weather'];
  isClothingShortage: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAdoptClick: () => void;
  onRequestClick: () => void;
  onRegisterClothingClick: () => void;
  finalFocus?: RefObject<HTMLElement | null>;
}

const OutfitInfoSheet = (props: OutfitInfoSheetProps) => {
  const {
    outfit,
    weather,
    isClothingShortage,
    isOpen,
    onOpenChange,
    onAdoptClick,
    onRequestClick,
    onRegisterClothingClick,
    finalFocus,
  } = props;
  const styleCds = getOutfitStyleTags(outfit.items);

  return (
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="코디 정보"
      isTitleHidden
      maxHeight="85dvh"
      finalFocus={finalFocus}
      footer={
        <>
          <Button icon="check" isFullWidth onClick={onAdoptClick}>
            채택하기
          </Button>
          <Button
            variant="outline"
            size="md"
            icon="edit"
            isFullWidth
            onClick={onRequestClick}
          >
            수정 요청하기
          </Button>
        </>
      }
    >
      <S.Content>
        {isClothingShortage && (
          <S.Shortage>
            <S.ShortageIcon>
              <Icon name="info-fill" size="sm" />
            </S.ShortageIcon>
            <S.ShortageText>
              옷장에 옷이 부족해 기본 아이템을 섞었어요
            </S.ShortageText>
            <Button size="sm" onClick={onRegisterClothingClick}>
              옷 등록
            </Button>
          </S.Shortage>
        )}
        {styleCds.length > 0 && (
          <S.Tags>
            {styleCds.map((styleCd) => (
              <Tag key={styleCd}>{getStyleLabel(styleCd)}</Tag>
            ))}
          </S.Tags>
        )}
        <S.ItemGrid>
          {outfit.items.map((item, itemIndex) => (
            // 같은 옷이 두 번 올 수 없지만 고유 번호가 없어 이름과 순서로 구분한다.
            <li key={`${item.item_name}-${itemIndex}`}>
              <OutfitItemImage item={item} />
              <S.ItemName $isEssential={item.item_source_cd === 'essential'}>
                {item.item_name}
              </S.ItemName>
            </li>
          ))}
        </S.ItemGrid>
        {weather && (
          <S.Weather>
            <S.WeatherLine>
              <Icon
                name={WEATHER_CONDITION_ICONS[weather.weather_condition_cd]}
                size="sm"
              />
              <S.WeatherLabel>{getWeatherLabel(weather)}</S.WeatherLabel>
              {weather.is_fallback && <S.EstimatedBadge>추정</S.EstimatedBadge>}
            </S.WeatherLine>
            {weather.is_fallback && (
              <S.WeatherNotice>
                날씨를 불러오지 못해 예상 날씨로 골랐어요.
              </S.WeatherNotice>
            )}
          </S.Weather>
        )}
        {outfit.reason !== null && (
          <section>
            <S.ReasonHeading>
              <Icon name="star_shine" size="sm" />
              추천 이유
            </S.ReasonHeading>
            <S.ReasonText>{outfit.reason}</S.ReasonText>
          </section>
        )}
      </S.Content>
    </BottomSheet>
  );
};

export default OutfitInfoSheet;
