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


class _RecordingDb:
    def __init__(self, rows):
        self._rows = rows
        self.params = None

    async def execute(self, stmt, params):
        self.params = params
        return _Result(self._rows)


async def test_count_completed_by_category_fills_missing_with_zero():
    db = _RecordingDb([])

    counts = await clothing_repo.count_completed_by_category(
        db, member_id=7, category_cds=("top", "bottom", "shoes")
    )

    assert counts == {"top": 0, "bottom": 0, "shoes": 0}
    assert db.params == {"member_id": 7, "category_cds": ["top", "bottom", "shoes"]}


async def test_count_completed_by_category_merges_rows():
    db = _RecordingDb([_Row(category_cd="top", cnt=3), _Row(category_cd="shoes", cnt=1)])

    counts = await clothing_repo.count_completed_by_category(
        db, member_id=7, category_cds=("top", "bottom", "shoes")
    )

    assert counts == {"top": 3, "bottom": 0, "shoes": 1}


async def test_get_clothing_snapshots_filters_by_member_and_ids():
    row = _Row(
        clothing_id=11,
        item_name=None,
        color_nm="화이트",
        origin_image_url="http://a/11.png",
        cutout_image_url=None,
    )
    db = _RecordingDb([row])

    snapshots = await clothing_repo.get_clothing_snapshots(db, member_id=7, clothing_ids=[11, 12])

    assert db.params == {"member_id": 7, "clothing_ids": [11, 12]}
    assert list(snapshots) == [11]
    assert snapshots[11].item_name is None
    assert snapshots[11].color_nm == "화이트"


async def test_get_clothing_snapshots_skips_query_for_empty_ids():
    db = _RecordingDb([])

    assert await clothing_repo.get_clothing_snapshots(db, member_id=7, clothing_ids=[]) == {}
    assert db.params is None


class _InsertResult:
    def __init__(self, lastrowid):
        self.lastrowid = lastrowid


class _InsertDb:
    def __init__(self):
        self.executed = []
        self.committed = False

    async def execute(self, stmt, params):
        self.executed.append((str(stmt), params))
        return _InsertResult(55)

    async def commit(self):
        self.committed = True


async def test_insert_uploaded_clothing_creates_clothing_and_bg_removal_job():
    db = _InsertDb()

    clothing_id = await clothing_repo.insert_uploaded_clothing(db, 7, "clothing/7/a.webp")

    assert clothing_id == 55
    (clothing_sql, clothing_params), (job_sql, job_params) = db.executed
    assert "INSERT INTO clothing (" in clothing_sql and "'processing'" in clothing_sql
    assert clothing_params == {"member_id": 7, "origin_image_url": "clothing/7/a.webp"}
    assert "INSERT INTO clothing_job" in job_sql
    assert job_params == {"clothing_id": 55, "stage_cd": "bg_removal"}
    assert not db.committed
