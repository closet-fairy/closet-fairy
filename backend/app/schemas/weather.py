from typing import Literal

from pydantic import BaseModel, Field

WeatherConditionCd = Literal["clear", "cloudy", "overcast", "rain", "sleet", "snow"]


class WeatherPreview(BaseModel):
    temperature: float
    feels_like_temperature: float
    weather_condition_cd: WeatherConditionCd = Field(
        description=(
            "강수가 있으면 강수형태(rain 비, sleet 비/눈, snow 눈)를 우선하고, "
            "없으면 하늘상태(clear 맑음, cloudy 구름많음, overcast 흐림)를 준다."
        )
    )
    is_fallback: bool = Field(
        description=(
            "true면 기상청 조회에 실패해 대체값을 준 것이다. "
            "이때 기온은 지역과 무관한 서울 월평년값이고, "
            "weather_condition_cd는 실제 하늘상태가 아니다."
        )
    )
    is_sky_missing: bool = Field(
        description=(
            "true면 하늘상태(SKY) 예보가 없어 weather_condition_cd를 clear로 가정한 것이다. "
            "기온·체감온도는 실제 조회값이므로, "
            "하늘상태 표시만 숨기고 기온은 그대로 보여주면 된다. "
            "is_fallback이 true면 날씨 전체가 대체값이며, 이때 이 값은 false로 온다."
        )
    )
