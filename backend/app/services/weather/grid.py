"""위경도 → 기상청 5km 격자(nx, ny) 변환. 기상청 공식 LCC 변환식."""
import math

RE, GRID = 6371.00877, 5.0
SLAT1, SLAT2, OLON, OLAT, XO, YO = 30.0, 60.0, 126.0, 38.0, 43, 136


def to_grid(lat: float, lon: float) -> tuple[int, int]:
    degrad = math.pi / 180.0
    re = RE / GRID
    slat1, slat2 = SLAT1 * degrad, SLAT2 * degrad
    olon, olat = OLON * degrad, OLAT * degrad
    sn = math.tan(math.pi * 0.25 + slat2 * 0.5) / math.tan(math.pi * 0.25 + slat1 * 0.5)
    sn = math.log(math.cos(slat1) / math.cos(slat2)) / math.log(sn)
    sf = math.tan(math.pi * 0.25 + slat1 * 0.5)
    sf = math.pow(sf, sn) * math.cos(slat1) / sn
    ro = math.tan(math.pi * 0.25 + olat * 0.5)
    ro = re * sf / math.pow(ro, sn)
    ra = math.tan(math.pi * 0.25 + lat * degrad * 0.5)
    ra = re * sf / math.pow(ra, sn)
    theta = lon * degrad - olon
    if theta > math.pi:
        theta -= 2.0 * math.pi
    if theta < -math.pi:
        theta += 2.0 * math.pi
    theta *= sn
    nx = int(ra * math.sin(theta) + XO + 0.5)
    ny = int(ro - ra * math.cos(theta) + YO + 0.5)
    return nx, ny
