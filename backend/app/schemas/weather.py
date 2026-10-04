from pydantic import BaseModel, Field


class WeatherPreview(BaseModel):
    temperature: float
    feels_like_temperature: float
    weather_condition_cd: str = Field(
        description="clear, cloudy, overcast, rain, sleet, snow 중 하나."
    )
    is_fallback: bool = Field(
        description=(
            "true면 기상청 조회에 실패해 대체값을 준 것이다. "
            "이때 기온은 지역과 무관한 서울 월평년값이고, "
            "weather_condition_cd는 실제 하늘상태가 아니다."
        )
    )
