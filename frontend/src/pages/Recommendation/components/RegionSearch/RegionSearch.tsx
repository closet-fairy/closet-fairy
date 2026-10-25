import { useId, useRef, useState } from 'react';
import Button from '@/components/common/Button';
import FullScreenDialog from '@/components/common/FullScreenDialog';
import ListItem from '@/components/common/ListItem';
import Notice from '@/components/common/Notice';
import TextField from '@/components/common/TextField';
import type { RegionSearchResult } from '@/domains/recommendation/searchRegions';
import { searchRegions } from '@/domains/recommendation/searchRegions';
import { useListRegionsRegionsGet } from '@/generated/endpoints/region/region';
import * as S from './RegionSearch.styled';

interface RegionSearchProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSelect: (region: RegionSearchResult) => void;
  notice?: string | null;
}

const RegionSearch = (props: RegionSearchProps) => {
  const { isOpen, onOpenChange, onSelect, notice = null } = props;

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const noticeId = useId();
  const {
    data: regions,
    isError,
    isFetching,
    refetch,
  } = useListRegionsRegionsGet({ query: { staleTime: Infinity } });

  const results = regions ? searchRegions(regions, query) : [];
  const isQueryEmpty = query.trim() === '';
  const isLoading = regions === undefined && (isFetching || !isError);

  const getStatusMessage = () => {
    if (isLoading) {
      return '지역 목록을 불러오는 중이에요.';
    }

    if (isError) {
      return '지역 목록을 불러오지 못했어요.';
    }

    if (isQueryEmpty) {
      return '시·군·구 이름으로 찾아 주세요.';
    }

    if (results.length === 0) {
      return '검색 결과가 없어요.';
    }

    return null;
  };

  const statusMessage = getStatusMessage();

  const handleOpenChange = (nextIsOpen: boolean) => {
    if (!nextIsOpen) {
      setQuery('');
    }

    onOpenChange(nextIsOpen);
  };

  const handleSelect = (region: RegionSearchResult) => {
    setQuery('');
    onSelect(region);
  };

  return (
    <FullScreenDialog
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      title="주소 입력"
      initialFocus={inputRef}
      header={
        <S.Header>
          {notice && (
            <div id={noticeId}>
              <Notice variant="subtle" icon="info" title={notice} />
            </div>
          )}
          <TextField
            ref={inputRef}
            type="search"
            value={query}
            onChange={setQuery}
            placeholder="예: 성동구, 수원"
            icon="search"
            hasClearButton
            onClear={() => setQuery('')}
            enterKeyHint="search"
            autoComplete="off"
            aria-label="지역 검색"
            aria-describedby={notice ? noticeId : undefined}
          />
        </S.Header>
      }
    >
      <S.Placeholder>
        <S.Status role="status">{statusMessage}</S.Status>
        {isError && !isFetching && (
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            다시 시도
          </Button>
        )}
      </S.Placeholder>
      {statusMessage === null && (
        <S.List>
          {results.map((region) => (
            <li key={region.fullName}>
              <ListItem
                icon="location_on"
                title={region.fullName}
                onClick={() => handleSelect(region)}
              />
            </li>
          ))}
        </S.List>
      )}
    </FullScreenDialog>
  );
};

export default RegionSearch;
