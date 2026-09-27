# closet-fairy backend

FastAPI + MySQL 8.0 (최소 8.0.16). Python 3.12.

## 실행 순서

1. **가상환경** — `backend/`에서 `py -3.12 -m venv .venv` 후 `.venv\Scripts\activate`
2. **패키지 설치** — `pip install -r requirements.txt`
3. **환경 변수** — `.env.example`을 `.env`로 복사한 뒤 값을 채운다 (`.env`는 커밋 금지)
4. **DB 기동 + 시드** — `backend/`에서  `docker compose up -d` 후 `bash scripts/seed.sh`
5. **서버 실행** — `uvicorn app.main:app --reload` → http://localhost:8000/docs

`/health`가 200을 반환하면 정상이다.

## 참고

- 커밋 시 ruff가 자동으로 실행된다. 최초 1회만 `pre-commit install`을 실행하면 된다.
- 테스트는 `pytest`로 실행한다.
- 운영 설정값(점수 상수·룰 딕셔너리·프롬프트)은 DB가 아니라 `.env`와 설정 파일에 둔다 (MAR-001~003).