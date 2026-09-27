"""체감온도 계산. 기상청 API는 체감온도를 직접 주지 않는다.

1주차 범위: 겨울 체감온도(바람) 공식만 적용하고, 그 외에는 기온을 그대로 쓴다.
"""


def feels_like(temperature: float, wind_speed_ms: float) -> float:
    """기온(℃), 풍속(m/s) → 체감온도(℃). 기온 10℃ 이하 + 풍속 1.3m/s 이상일 때만 보정."""
    if temperature <= 10 and wind_speed_ms >= 1.3:
        v = (wind_speed_ms * 3.6) ** 0.16  # 공식은 km/h 기준
        value = 13.12 + 0.6215 * temperature - 11.37 * v + 0.3965 * v * temperature
        return round(value, 1)
    return round(temperature, 1)
