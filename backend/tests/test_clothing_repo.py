from app.repositories import clothing as clothing_repo


class _Row:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeDb:
    def __init__(self, results):
        self._results = results
        self._calls = 0

    async def execute(self, stmt, params):
        result = self._results[self._calls]
        self._calls += 1
        return result


async def test_get_completed_clothing_merges_tags_by_clothing_id():
    clothing_rows = [
        _Row(
            clothing_id=1,
            category_cd="top",
            accessory_type_cd=None,
            item_name="니트",
            color_cd="beige",
            thickness_cd="medium",
            is_waterproof=0,
            origin_image_url="http://a/1.png",
            cutout_image_url=None,
        ),
        _Row(
            clothing_id=2,
            category_cd="bottom",
            accessory_type_cd=None,
            item_name="슬랙스",
            color_cd="black",
            thickness_cd="thin",
            is_waterproof=None,
            origin_image_url="http://a/2.png",
            cutout_image_url="http://a/2_cutout.png",
        ),
    ]
    style_rows = [
        _Row(clothing_id=1, style_cd="casual"),
        _Row(clothing_id=1, style_cd="minimal"),
        _Row(clothing_id=2, style_cd="street"),
    ]
    season_rows = [
        _Row(clothing_id=1, season_cd="fall"),
        _Row(clothing_id=1, season_cd="spring"),
        _Row(clothing_id=2, season_cd="summer"),
    ]

    db = _FakeDb([_Result(clothing_rows), _Result(style_rows), _Result(season_rows)])

    candidates = await clothing_repo.get_completed_clothing(db, member_id=1)

    by_id = {c.clothing_id: c for c in candidates}
    assert by_id[1].styles == ["casual", "minimal"]
    assert by_id[1].seasons == ["fall", "spring"]
    assert by_id[1].is_waterproof is False
    assert by_id[2].styles == ["street"]
    assert by_id[2].seasons == ["summer"]
    assert by_id[2].is_waterproof is None
