import type { RefObject } from 'react';
import { useRef, useState } from 'react';
import BottomSheet from '@/components/common/BottomSheet';
import Button from '@/components/common/Button';
import ListItem from '@/components/common/ListItem';
import type { RegionSearchResult } from '@/domains/recommendation/searchRegions';
import { useFindNearestRegionRegionsNearestPost } from '@/generated/endpoints/region/region';
import { getCurrentPosition } from '@/utils/getCurrentPosition';
import type { RecommendationLocation } from '../../types';
import RegionSearch from '../RegionSearch';
import * as S from './LocationSheet.styled';

const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10 * 1000,
  maximumAge: 5 * 60 * 1000,
};

const GEOLOCATION_PERMISSION_DENIED = 1;

const NOTICE = {
  PERMISSION_DENIED:
    '위치 권한이 없어 현재 위치를 쓸 수 없어요. 주소를 직접 입력해 주세요.',
  REGION_NOT_FOUND:
    '현재 위치 근처에서 지역을 찾지 못했어요. 주소를 직접 입력해 주세요.',
  UNAVAILABLE: '현재 위치를 확인하지 못했어요. 주소를 직접 입력해 주세요.',
} as const;

const isPermissionDenied = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === GEOLOCATION_PERMISSION_DENIED;

interface LocationSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSelect: (location: RecommendationLocation) => void;
  finalFocus?: RefObject<HTMLElement | null>;
}

const LocationSheet = (props: LocationSheetProps) => {
  const { isOpen, onOpenChange, onSelect, finalFocus } = props;

  const [isLocating, setIsLocating] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  /*
   * 위치 확인은 취소할 수 없고, 이 시트는 닫혀도 화면에 남아 있어 늦게 온 결과가 그대로 반영된다.
   * 그래서 현재 위치를 찾을 때마다 번호를 매기고, 시트를 닫으면 번호를 올려 지난 시도의 결과는 버린다.
   */
  const locatingAttemptRef = useRef(0);
  const { mutate: findNearestRegion } =
    useFindNearestRegionRegionsNearestPost();

  const close = () => {
    locatingAttemptRef.current += 1;
    setIsLocating(false);
    setIsSearchOpen(false);
    setSearchNotice(null);
    onOpenChange(false);
  };

  const handleOpenChange = (nextIsOpen: boolean) => {
    if (nextIsOpen) {
      onOpenChange(true);
      return;
    }

    close();
  };

  const select = (location: RecommendationLocation) => {
    close();
    onSelect(location);
  };

  const openSearch = (notice: string | null) => {
    setSearchNotice(notice);
    setIsSearchOpen(true);
  };

  const handleCurrentLocationClick = async () => {
    if (isLocating) {
      return;
    }

    locatingAttemptRef.current += 1;
    const attempt = locatingAttemptRef.current;
    const isCurrentAttempt = () => attempt === locatingAttemptRef.current;
    setIsLocating(true);

    let position: GeolocationPosition;

    try {
      position = await getCurrentPosition(POSITION_OPTIONS);
    } catch (error) {
      if (isCurrentAttempt()) {
        setIsLocating(false);
        openSearch(
          isPermissionDenied(error)
            ? NOTICE.PERMISSION_DENIED
            : NOTICE.UNAVAILABLE,
        );
      }

      return;
    }

    if (!isCurrentAttempt()) {
      return;
    }

    findNearestRegion(
      {
        data: {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        },
      },
      {
        onSuccess: (region) => {
          if (isCurrentAttempt()) {
            select({
              sidoNm: region.sido_nm,
              sigunguNm: region.sigungu_nm,
              inputTypeCd: 'current',
            });
          }
        },
        onError: (error) => {
          if (isCurrentAttempt()) {
            setIsLocating(false);
            openSearch(
              error.code === 'REGION_NOT_FOUND'
                ? NOTICE.REGION_NOT_FOUND
                : NOTICE.UNAVAILABLE,
            );
          }
        },
      },
    );
  };

  const handleRegionSelect = (region: RegionSearchResult) => {
    select({
      sidoNm: region.sidoNm,
      sigunguNm: region.sigunguNm,
      inputTypeCd: 'manual',
    });
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      title="위치 설정"
      description="이 위치의 날씨로 코디를 추천합니다."
      finalFocus={finalFocus}
      footer={
        <Button variant="text" size="md" isFullWidth onClick={close}>
          닫기
        </Button>
      }
    >
      <S.Options>
        <ListItem
          variant="card"
          icon="my_location"
          title="현재 위치 사용"
          description={
            isLocating
              ? '현재 위치를 찾는 중이에요'
              : '위치 권한을 한 번 확인합니다'
          }
          hasChevron
          onClick={() => void handleCurrentLocationClick()}
        />
        <ListItem
          variant="card"
          icon="edit_location_alt"
          title="주소 직접 입력"
          description="시·구 단위까지"
          hasChevron
          isDisabled={isLocating}
          onClick={() => openSearch(null)}
        />
      </S.Options>
      <S.Status role="status">
        {isLocating
          ? '현재 위치를 찾는 중이에요. 찾는 동안 주소 직접 입력은 누를 수 없어요.'
          : ''}
      </S.Status>
      <RegionSearch
        isOpen={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        onSelect={handleRegionSelect}
        notice={searchNotice}
      />
    </BottomSheet>
  );
};

export default LocationSheet;
