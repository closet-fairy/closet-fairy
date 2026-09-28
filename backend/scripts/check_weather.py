"""#14 확인용. 실행: python -m scripts.check_weather 서울특별시 성동구"""

import asyncio
import logging
import sys

from app.services.weather.weather_service import get_weather

logging.basicConfig(level=logging.INFO)


async def main() -> None:
    sido = sys.argv[1] if len(sys.argv) > 1 else "서울특별시"
    sigungu = sys.argv[2] if len(sys.argv) > 2 else None
    r = await get_weather(sido, sigungu)
    print(f"대체값 사용: {r.is_fallback}")
    print(
        f"현재 기온 {r.temperature} / 체감 {r.feels_like_temperature} / 강수 {r.precipitation}mm "
        f"/ 풍속 {r.wind_speed}m/s / 상태 {r.weather_condition_cd}"
    )
    print(f"외출 시간대 최저 체감: {r.min_feels_like_temperature}")
    print(f"시간대별 {len(r.hourly)}개, 앞 3개:")
    for h in r.hourly[:3]:
        print(
            f"  {h.at:%m-%d %H:%M}  {h.temperature}℃ "
            f"체감 {h.feels_like_temperature}  {h.weather_condition_cd}"
        )


asyncio.run(main())
