# 백엔드
## 기술 스택
- FastAPI + SQLAlchemy(async) + aiomysql
- MySQL 8.0 (Docker Compose)
- pydantic-settings 기반 환경 변수 관리 (`.env`)
- pytest 기반 테스트

## 폴더 구조

- app/
- core/ # 설정, DB 세션, 공통 에러 정의
- api/ # 라우터 (엔드포인트만, 비즈니스 로직 없음)
- services/ # 비즈니스 로직
- repositories/ # DB 접근 계층 (쿼리는 여기에만)
- schemas/ # Pydantic 요청/응답 모델
- workers/ # 배치/스케줄 작업
- db/
- migrations/ # 스키마 마이그레이션 SQL
- seeds/ # 개발용 시드 데이터
- scripts/ # 실행 스크립트 (migrate.sh, seed.sh 등)
- tests/ # pytest


## 계층 규칙
- API 라우터는 요청 검증 + 서비스 호출만 하고, 비즈니스 로직을 직접 담지 않습니다.
- DB 쿼리는 repositories/에만 작성합니다. services/나 api/에서 직접 SQL을 작성하지 않습니다.
- 외부 API 호출(기상청 등)은 services/ 하위에 전용 클라이언트로 분리합니다.

## 환경 변수
- 모든 민감 정보(API 키, DB 비밀번호 등)는 `.env`에만 두고 커밋하지 않습니다.
- `app/core/config.py`의 `Settings` 클래스에 필드로 선언하고, 코드에서는 `settings.XXX`로만 접근합니다.
- 새 환경 변수를 추가하면 `.env.example`도 함께 갱신합니다.

## 테스트
- 새 함수/엔드포인트를 추가하면 `tests/`에 대응하는 테스트를 함께 작성합니다.
- PR 생성 전 `pytest`가 로컬에서 전부 통과하는지 확인합니다.

## 커밋 메시지
- Angular 컨벤션 + `design` 타입 사용: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `design`
- 예: `feat: 기상청 초단기실황 클라이언트 추가`

## 브랜치 네이밍
- `<type>/<branch-name>` 형식 (예: `feat/14-kma-client`)

## 기타
- 새 테이블/컬럼 추가 시 DB 컨벤션 문서(표준 용어 맵핑)를 따릅니다.
- 날짜/시간은 내부적으로 UTC로 저장하고, KST 변환이 필요한 곳(날씨 API 등)에서만 별도 처리합니다.
- 
이 지침은 `backend/` 아래 파일을 작성하거나 수정할 때만 적용한다. 다른 영역을 작업하다가 이 폴더 파일을 참고로 읽은 경우에는 따르지 않는다.
