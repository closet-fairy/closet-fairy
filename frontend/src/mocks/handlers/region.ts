import { http, HttpResponse } from 'msw';
import type { RegionName, SidoRegions } from '@/generated/models';

const REGIONS: SidoRegions[] = [
  {
    sido_nm: '서울특별시',
    sigungu_nms: ['종로구', '중구', '용산구', '성동구', '광진구', '강남구'],
  },
  { sido_nm: '부산광역시', sigungu_nms: ['중구', '해운대구'] },
  { sido_nm: '세종특별자치시', sigungu_nms: ['세종특별자치시'] },
  {
    sido_nm: '경기도',
    sigungu_nms: [
      '수원시 장안구',
      '수원시 권선구',
      '수원시 팔달구',
      '수원시 영통구',
      '성남시 분당구',
    ],
  },
  { sido_nm: '제주특별자치도', sigungu_nms: ['제주시', '서귀포시'] },
];

export const regionHandlers = [
  http.get('/api/regions', () => HttpResponse.json<SidoRegions[]>(REGIONS)),
  http.post('/api/regions/nearest', () =>
    HttpResponse.json<RegionName>({
      sido_nm: '서울특별시',
      sigungu_nm: '성동구',
    }),
  ),
];
