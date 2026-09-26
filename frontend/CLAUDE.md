# 프론트엔드

이 지침은 `frontend/` 아래 파일을 작성하거나 수정할 때만 적용한다. 다른 영역을 작업하다가 이 폴더 파일을 참고로 읽은 경우에는 따르지 않는다.

## 개요

- 이 프로젝트는 클라이언트 전용 SPA다. SSR과 서버 컴포넌트를 쓰지 않으며, `'use client'`, `'use server'` 지시어를 쓰지 않는다.
- 이 문서의 규칙은 사용자가 예외를 명시한 경우에만 따르지 않는다.

## 폴더 구조

```
frontend/src/
├─ routes/        TanStack Router 파일 기반 라우트
├─ pages/         화면
├─ components/    두 화면 이상에서 쓰는 컴포넌트
│  └─ common/     디자인 시스템 컴포넌트
├─ hooks/         두 화면 이상에서 쓰는 훅
├─ domains/       React와 무관한 비즈니스 규칙
├─ apis/          HTTP 클라이언트와 요청 설정
├─ generated/     orval 생성물
├─ mocks/         MSW 핸들러
├─ styles/        디자인 토큰, 전역 스타일, 폰트 선언
├─ assets/        icons/, images/, fonts/
├─ constants/     두 화면 이상에서 쓰는 상수
├─ types/         두 화면 이상에서 쓰는 타입
└─ utils/         도메인과 무관한 범용 함수
```

### 배치 규칙

- `routes/`에는 라우트 정의와 페이지 연결만 둔다. 화면 구현은 `pages/`에 둔다.
- 한 파일에서만 쓰는 상수, 타입, 헬퍼는 그 파일 안에 export 없이 둔다.
  파일이 길어지면 같은 폴더에 `X.constants.ts`, `X.types.ts`처럼 분리한다.
- 한 화면에서만 쓰는 컴포넌트는 사용처가 한 곳이어도 `pages/<화면>/components/`에 폴더로 둔다.
- 한 화면 안의 여러 파일에서 쓰는 훅, 상수, 타입은 그 화면 폴더에 둔다.
  - `pages/Closet/components/`, `pages/Closet/hooks/`, `pages/Closet/constants.ts`, `pages/Closet/types.ts`
- 두 화면 이상에서 쓰게 되면 `components/`, `hooks/`, `constants/`, `types/`로 옮긴다.
- `components/common/`에는 옷장요정의 도메인을 모르는 컴포넌트만 둔다.
  도메인 데이터를 props로 받거나 도메인 용어가 들어가면 `components/` 바로 아래에 둔다.
  - ✅ `components/common/Button`, `components/StatusBadge`
  - ❌ `components/common/ClothCard`
- 요구사항에서 온 비즈니스 규칙은 쓰는 곳이 한 곳이어도 `domains/`에 둔다.
  단순한 표시용 변환은 쓰는 파일 안에 둔다.
- `domains/`에는 React에 의존하지 않고 API 요청이나 전역 상태를 건드리지 않는 순수 함수만 둔다.
  도메인별로 하위 폴더를 나눈다.
  - ✅ `domains/cloth/validateUploadFile.ts`
  - ❌ React 훅, 컴포넌트, API 요청 함수
- `utils/`에는 도메인 용어가 없는 범용 함수만 둔다. 도메인 용어가 들어가면 `domains/`에 둔다.
  - ✅ `utils/formatDate.ts`
  - ❌ `utils/getClothLabel.ts`
- `generated/`는 직접 수정하지 않는다. 바꿔야 하면 orval 설정이나 API 스펙을 고친 뒤 다시 생성한다.

## 컴포넌트

### 폴더 구성

컴포넌트는 이름과 같은 폴더를 만들고 아래 파일을 둔다.
사용처가 한 곳이어도 예외 없이 폴더를 만들며, 한 파일 안에 다른 컴포넌트를 정의하지 않는다.

```
ClothCard/
├─ ClothCard.tsx          컴포넌트
├─ ClothCard.styled.ts    스타일
├─ ClothCard.stories.tsx  스토리
└─ index.ts               export { default } from './ClothCard';
```

- `index.ts`는 항상 둔다. 내용은 위의 한 줄로 고정한다. 화면 폴더에도 같은 형태의 `index.ts`를 둔다.
- 필요하면 `ClothCard.test.tsx`, `ClothCard.constants.ts`, `ClothCard.types.ts`를 추가한다.

### 작성 방식

- 컴포넌트는 화살표 함수로 정의하고 default export한다.
- props 타입은 `interface <컴포넌트명>Props`로 정의한다.
- props는 매개변수에서 구조 분해하지 않고, 함수 본문 첫 줄에서 구조 분해한다.
  - ✅ `const ClothCard = (props: ClothCardProps) => { const { cloth, onSelect } = props; ... }`
  - ❌ `const ClothCard = ({ cloth, onSelect }: ClothCardProps) => { ... }`
- 스타일은 `import * as S from './ClothCard.styled';`로 가져와 `<S.Container>`처럼 쓴다.
- ref는 일반 prop으로 받는다. `forwardRef`는 쓰지 않는다.
- Context는 `<XContext value={...}>`로 제공한다. `.Provider`는 쓰지 않는다.
- 불리언 props는 `is`, `has` 접두사를 붙인다. 이벤트 props는 `on` 접두사를 붙인다.
  - ✅ `isSelected`, `hasError`, `onSelect`

### 이름

- 컴포넌트 폴더와 파일: PascalCase (`ClothCard/ClothCard.tsx`)
- 화면 컴포넌트: `<화면>Page` (`pages/Closet/ClosetPage.tsx`)
- 훅: `use`로 시작하는 camelCase (`useClothPolling.ts`)
- 함수: 동사로 시작하는 camelCase (`validateUploadFile.ts`)

## 스타일링

### 작성 방식

- 스타일은 Emotion `styled`로 `X.styled.ts`에 작성한다.
- `css` prop은 지양한다. `X.styled.ts` 안에서 스타일 조각을 재사용하거나 조건부로 합칠 때는 `css` 헬퍼를 쓴다.
- inline `style`은 렌더링 중 계산되는 값에만 쓴다.
  - ✅ `` style={{ transform: `rotate(${angle}deg)` }} ``
  - ❌ `style={{ padding: 16 }}`

### 토큰

- 색은 시맨틱 토큰만 쓴다. 원시 팔레트와 색상 값을 컴포넌트에서 직접 쓰지 않는다.
  - ✅ `bg.brand.soft`
  - ❌ `palette.brand500`, `'#5b4bd6'`
- 간격, radius, 글자 스타일, 그림자, z-index, 모션도 토큰을 쓴다.
- 컴포넌트에서 라이트와 다크를 분기하지 않는다. 테마에 따른 차이는 토큰이 처리한다.
- 필요한 토큰이 없으면 임의 값을 쓰지 않고, 토큰 추가를 먼저 제안한다.

### 헤드리스 컴포넌트

- 동작이 까다로운 컴포넌트(모달, 확인 대화상자, Select, 팝오버, 탭, 토글 그룹, 바텀시트, 토스트)는
  Radix 등 헤드리스 라이브러리를 감싸 `components/common/`에 만든다.
- 헤드리스 라이브러리는 `components/common/` 안에서만 import한다. 화면과 다른 컴포넌트는 감싼 컴포넌트를 쓴다.
  - ✅ `import Dialog from '@/components/common/Dialog';`
  - ❌ `import * as Dialog from '@radix-ui/react-dialog';` (`components/common/` 밖에서)

### 모바일

- 터치할 수 있는 요소는 터치 영역 44×44px 이상을 권장한다.
  이보다 작게 구현하는 경우 해당 요소와 크기를 사용자에게 알린다.

## TypeScript

- `strict` 모드를 전제로 작성한다.
- `any`를 쓰지 않는다. 타입을 알 수 없으면 `unknown`으로 받고 좁혀서 쓴다.
- `as` 타입 단언과 non-null 단언 `!`은 원칙적으로 쓰지 않는다. 타입 가드, 타입 좁히기, zod 검증을 쓴다.
  - `as const`는 허용한다. 값이 타입을 만족하는지 확인만 하려면 `satisfies`를 쓴다.
- 단언을 피하는 쪽이 명백히 손해라고 판단되면 다음 절차를 따른다.
  1. 단언이 필요한 지점을 사용자에게 알리고, 그 부분의 구현은 보류한다.
  2. 단언이 필요한 이유를 기술적으로 설명한다.
  3. 사용자가 동의한 경우에만 단언한다. 동의가 없으면 단언하지 않는다.
- 위 절차를 밟을 수 있는 경우는 다음뿐이다.
  - 단언을 피하는 방법이 얻는 것 없이 큰 손해를 유발하는 경우
  - 단언을 피해도 근본 문제가 해결되지 않고 보일러플레이트만 크게 늘어나는 경우
  - 중요 로직이 아닌 곳(예: 테스트용 객체)에서 단언을 피하는 비용이 압도적인 경우
- 다음은 단언의 사유가 되지 않는다.
  - 단언하는 쪽 코드가 더 깔끔하다는 이유. 타입의 구멍을 메우는 비용은 안전을 위한 대가이며, 깔끔하지만 위험한 코드가 더 나쁘다.
  - 라이브러리 예제나 기존 코드가 단언을 쓴다는 이유.
- 타입만 가져올 때는 `import type`을 별도 문으로 쓴다.
  - ✅ `import type { Cloth } from '@/types/cloth';`
  - ❌ `import { type Cloth, getCloth } from ...`
- `enum`을 쓰지 않는다. 문자열 리터럴 유니언이나 `as const` 객체를 쓴다.
- 객체 형태는 `interface`로, 유니언과 별칭 등 나머지는 `type`으로 정의한다.
- 외부에서 들어오는 데이터(API 응답, localStorage, URL 파라미터)는 zod로 검증한 뒤 쓴다.
  내부 값의 타입을 좁힐 때는 `data is X` 형태의 타입 가드를 써도 된다.

## 데이터와 API

### 서버 상태

- 서버에서 받은 데이터는 TanStack Query로 다룬다.
- Query로 받은 데이터를 `useState`나 Context에 복사해 두지 않는다. 필요한 값은 Query 결과에서 계산해 쓴다.
  - ❌ `const [clothes, setClothes] = useState(data);`
- 전역 클라이언트 상태가 필요해 보이면 상태 관리 라이브러리를 추가하기 전에 사용자에게 먼저 제안한다.

### API 요청

- API 요청은 orval이 생성한 훅과 함수를 쓴다. 요청 함수, 응답 타입, Query 키를 직접 만들지 않는다.
- axios는 `apis/`의 공용 인스턴스만 쓴다. 다른 곳에서 axios를 직접 import하지 않는다.
- API 스펙이 나오기 전 임시로 작성한 요청 코드는 `apis/`에 두고, 스펙이 나오면 생성물로 교체한다.

### 응답 검증

- 모든 API 응답은 Query 캐시에 들어가기 전에 zod로 검증한다.
- 검증에 실패하면 Query의 에러로 처리한다. 잘못된 데이터를 그대로 화면에 넘기지 않는다.

### 에러

- 서버 에러 응답(`{ code, message }`)은 `apis/`에서 공통 에러 형태로 바꾼다. 화면은 이 공통 형태만 다룬다.

### 모킹

- 새 API를 쓰기 시작하면 `mocks/`에 MSW 핸들러를 함께 추가한다.

## 테스트와 스토리

### 위치

- 테스트와 스토리는 대상 파일 옆에 둔다. (`ClothCard.test.tsx`, `ClothCard.stories.tsx`)

### 스토리

- 모든 컴포넌트에 스토리를 작성한다. 단, 화면 컴포넌트(`pages/<화면>/<화면>Page.tsx`)의 스토리는 선택이다.
- 스토리 `title`은 지정하지 않는다. 파일 경로에서 자동으로 정해지게 둔다.
- 기본 상태와 함께, 컴포넌트가 가질 수 있는 주요 상태를 각각 스토리로 만든다.
  - 예: 비활성, 로딩, 에러, 빈 상태, 긴 텍스트
- 스토리에서 쓰는 API 데이터는 MSW 핸들러로 제공한다.

### 테스트

- `domains/`의 함수는 단위 테스트를 작성한다.
- 컴포넌트와 훅의 테스트는 필요한 경우에만 작성한다.
- 테스트 파일에 대상 이름으로 감싸는 바깥 `describe`를 두지 않는다. 파일 이름이 대상을 나타낸다.
- `describe`에는 시나리오 묶음을 한국어 명사형 제목으로 쓴다. 온점을 붙이지 않는다.
  - ✅ `describe('업로드 파일 형식 검증', ...)`
- 개별 테스트는 `it`이 아니라 `test`로 쓴다.
- 테스트 설명은 한국어 평서문으로, "~해야 한다." 형태로 쓰고 온점으로 끝낸다.
  - ✅ `test('버튼이 비활성화된 상태에서는 클릭하더라도 API 요청이 나가지 않아야 한다.', ...)`
  - ❌ `test('비활성 버튼 클릭 테스트', ...)`
  - ❌ `test('should not send request when disabled', ...)`
- 컴포넌트 테스트는 사용자가 보는 기준으로 요소를 찾는다. 클래스명이나 내부 구조에 의존하지 않는다.
  - ✅ `getByRole('button', { name: '옷 등록' })`
  - ❌ `container.querySelector('.css-1x2y3z')`
- 네트워크가 필요한 테스트는 MSW로 응답을 제공한다. `apis/`나 axios를 직접 모킹하지 않는다.

## 주석

- 무엇을 적을지는 루트 `CLAUDE.md`의 "주석" 원칙을 따른다.
- 한 줄 주석은 `//`로 쓴다.
- 두 줄 이상이면 `/* */`로 쓰고, 각 줄 앞에 `*`를 붙인다.

  ```ts
  /*
   * 서버가 처리 시간을 밀리초 단위로 내려준다.
   * 화면에는 초 단위로 보여 주므로 여기서 변환한다.
   */
  ```

- 주석은 반말 평서문으로, 온점으로 끝나는 완성된 문장으로 쓴다.
  - ✅ `// 서버가 밀리초 단위로 내려주므로 초 단위로 바꾼다.`
  - ❌ `// 밀리초 -> 초 변환`
  - ❌ `// 서버가 밀리초 단위로 내려줍니다.`
