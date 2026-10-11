"""옷·추천 스키마가 함께 쓰는 코드값. DB CHECK 제약과 같은 집합이다."""

from typing import Literal

CategoryCd = Literal["outer", "top", "bottom", "shoes", "socks", "accessories"]
AccessoryTypeCd = Literal["hat", "bag", "belt", "watch", "scarf", "eyewear", "jewelry", "etc"]
SeasonCd = Literal["spring", "summer", "fall", "winter"]
StyleCd = Literal[
    "minimal",
    "casual",
    "street",
    "classic",
    "formal",
    "sporty",
    "romantic",
    "vintage",
    "bohemian",
    "preppy",
    "chic",
    "unique",
    "feminine",
]
ColorCd = Literal[
    "black",
    "white",
    "gray",
    "beige",
    "brown",
    "navy",
    "blue",
    "sky_blue",
    "green",
    "khaki",
    "yellow",
    "orange",
    "red",
    "pink",
]
ThicknessCd = Literal["thin", "medium", "thick"]
