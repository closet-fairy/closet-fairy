# closet-fairy backend

FastAPI + MySQL 8.0 (최소 8.0.19). Python 3.12.

## 실행 순서

> Windows는 **Git Bash** 셸에서 실행한다 (VS Code 터미널에서 Git Bash 선택 가능).
> 모든 명령은 `backend/` 폴더 기준이다.

0. **사전 준비**
   - Python 3.12, Docker Desktop 설치
   - Docker Desktop 실행 후 **Engine running** 확인
1. **가상환경**
```bash
   py -3.12 -m venv .venv
   source .venv/Scripts/activate      # Mac/Linux: source .venv/bin/activate
```
2. **패키지 설치** — `pip install -r requirements.txt`
3. **환경 변수** — `cp .env.example .env` (`.env`는 커밋 금지)
   - 로컬 개발은 기본값 그대로 동작한다. 주석(`#`) 처리된 항목은 값을 바꿀 때만 주석을 풀고 채운다.
   - 값을 비운 채로 주석만 풀면 서버가 기동되지 않는다.
4. **DB 기동** — `docker compose up -d`
   - 최초 실행 시 이미지 다운로드로 수 분 소요
   - `docker compose ps`의 STATUS가 **`(healthy)`**가 될 때까지 기다린 뒤 다음 단계로 간다
5. **마이그레이션** — `bash scripts/migrate.sh`
6. **시드** — `bash scripts/seed.sh`
7. **서버 실행** — `uvicorn app.main:app --reload` → http://localhost:8000/docs

`/health`가 200을 반환하면 정상이다.

## DB를 처음 상태로 초기화

```bash
docker compose down -v
docker compose up -d
# (healthy) 확인 후
bash scripts/migrate.sh
bash scripts/seed.sh
```

## 문제 해결

### `docker compose up`에서 포트 에러 발생함

`Only one usage of each socket address ... is normally permitted` 에러가 나면
PC에 직접 설치된 MySQL이 3306 포트를 쓰고 있는 것이다.

1. 확인: `netstat -ano | grep :3306` → `LISTENING`이 보이면 충돌
2. 중지: `Win + R` → `services.msc` → **MySQL80** 우클릭 → **중지**
   - 재부팅 후에도 충돌하지 않게 하려면 속성 → 시작 유형 **수동**
   - 중지만 하는 것이므로 로컬 MySQL 데이터는 지워지지 않는다
3. 다시 실행: `docker compose up -d`

### `migrate.sh`/`seed.sh`에서 `Can't connect` 또는 `Access denied`

DB가 아직 준비 중이다. `docker compose ps`에서 `(healthy)`를 확인한 뒤 다시 실행한다.

## 참고

- 커밋 시 ruff가 자동으로 실행된다. 최초 1회만 `pre-commit install`을 실행하면 된다.
- 테스트는 `pytest`로 실행한다.
- 운영 설정값(점수 상수·룰 딕셔너리·프롬프트)은 DB가 아니라 `.env`와 설정 파일에 둔다 (MAR-001~003).