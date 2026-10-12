"""옷 수정 서비스 테스트. 리포지토리·상세 조회는 가짜로 바꿔 끼운다."""

import io
import threading
from decimal import Decimal
from types import SimpleNamespace

import pytest
from PIL import Image

from app.repositories import clothing as clothing_repo
from app.repositories import clothing_tag as tag_repo
from app.repositories.clothing import ClothingEditRow, ClothingForEdit
from app.schemas.clothing import ClothingEditUpdate, ClothingUpdate
from app.services import clothing_edit as edit
from app.services.clothing_edit import (
    AccessoryTypeNotAllowedError,
    ClothingNotEditableError,
    InvalidMaskError,
    MaskSizeMismatchError,
    MaskTooLargeError,
)
from app.services.clothing_query import ClothingNotFoundError
from app.services.storage import LocalImageStorage

MEMBER_ID = 7
CUTOUT_KEY = "clothing/7/a_cutout.webp"


class _Transaction:
    def __init__(self, db):
        self._db = db

    async def __aenter__(self):
        self._db.transactions += 1

    async def __aexit__(self, exc_type, *exc):
        if exc_type is None:
            self._db.commits += 1
        return False


class _FakeDb:
    def __init__(self):
        self.transactions = 0
        self.commits = 0

    def begin(self):
        return _Transaction(self)


def _clothing(**overrides) -> ClothingForEdit:
    fields = dict(
        clothing_id=5,
        processing_status_cd="completed",
        origin_image_url="clothing/7/a.webp",
        cutout_image_url=CUTOUT_KEY,
        category_cd="top",
        accessory_type_cd=None,
        color_cd="white",
    )
    return ClothingForEdit(**{**fields, **overrides})


@pytest.fixture
def repo(monkeypatch):
    r = SimpleNamespace(
        clothing=_clothing(),
        edit=None,
        locks=[],
        updates=[],
        styles=[],
        seasons=[],
        reviewed=[],
        transforms=[],
        masks=[],
        deleted_edits=[],
        mask_error=None,
    )

    async def get_clothing_for_edit(db, member_id, clothing_id, *, lock=False):
        r.locks.append((member_id, clothing_id, lock))
        return r.clothing

    async def update_clothing_attributes(db, clothing_id, values):
        r.updates.append((clothing_id, values))

    async def replace_styles(db, clothing_id, style_cds):
        r.styles.append((clothing_id, style_cds))

    async def replace_seasons(db, clothing_id, season_cds):
        r.seasons.append((clothing_id, season_cds))

    async def mark_reviewed(db, clothing_id):
        r.reviewed.append(clothing_id)

    async def get_clothing_edit(db, clothing_id):
        return r.edit

    async def upsert_edit_transform(db, clothing_id, rotation_angle, perspective_param):
        r.transforms.append((clothing_id, rotation_angle, perspective_param))

    async def upsert_edit_mask(db, clothing_id, brush_mask_url):
        if r.mask_error:
            raise r.mask_error
        r.masks.append((clothing_id, brush_mask_url))

    async def delete_clothing_edit(db, clothing_id):
        r.deleted_edits.append(clothing_id)

    async def get_clothing_detail(db, storage, member_id, clothing_id):
        return ("detail", member_id, clothing_id)

    for module, name, fn in [
        (clothing_repo, "get_clothing_for_edit", get_clothing_for_edit),
        (clothing_repo, "update_clothing_attributes", update_clothing_attributes),
        (clothing_repo, "mark_reviewed", mark_reviewed),
        (clothing_repo, "get_clothing_edit", get_clothing_edit),
        (clothing_repo, "upsert_edit_transform", upsert_edit_transform),
        (clothing_repo, "upsert_edit_mask", upsert_edit_mask),
        (clothing_repo, "delete_clothing_edit", delete_clothing_edit),
        (tag_repo, "replace_styles", replace_styles),
        (tag_repo, "replace_seasons", replace_seasons),
        (edit, "get_clothing_detail", get_clothing_detail),
    ]:
        monkeypatch.setattr(module, name, fn)
    return r


@pytest.fixture
def storage(tmp_path):
    path = tmp_path / CUTOUT_KEY
    path.parent.mkdir(parents=True)
    Image.new("RGBA", (40, 60)).save(path, format="WEBP")
    return LocalImageStorage(tmp_path, "/media")


async def _update(repo, **body):
    return await edit.update_clothing(_FakeDb(), None, MEMBER_ID, 5, ClothingUpdate(**body))


async def test_update_changes_only_sent_fields_and_marks_reviewed(repo):
    result = await _update(repo, item_name="  흰   셔츠 ", thickness_cd=None)

    assert repo.updates == [(5, {"item_name": "흰 셔츠", "thickness_cd": None})]
    assert repo.styles == [] and repo.seasons == []
    assert repo.reviewed == [5]
    assert repo.locks == [(MEMBER_ID, 5, True)]
    assert result == ("detail", MEMBER_ID, 5)


async def test_blank_item_name_is_stored_as_empty(repo):
    await _update(repo, item_name="   ")

    assert repo.updates == [(5, {"item_name": None})]


async def test_styles_and_seasons_replace_whole_list_without_duplicates(repo):
    await _update(repo, style_cds=["casual", "street", "casual"], season_cds=None)

    assert repo.styles == [(5, ("casual", "street"))]
    assert repo.seasons == [(5, ())]


async def test_leaving_accessories_clears_accessory_type(repo):
    repo.clothing = _clothing(category_cd="accessories", accessory_type_cd="bag")

    await _update(repo, category_cd="top")

    assert repo.updates == [(5, {"category_cd": "top", "accessory_type_cd": None})]


async def test_clearing_category_clears_accessory_type(repo):
    repo.clothing = _clothing(category_cd="accessories", accessory_type_cd="bag")

    await _update(repo, category_cd=None)

    assert repo.updates == [(5, {"category_cd": None, "accessory_type_cd": None})]


@pytest.mark.parametrize(
    "body",
    [
        {"accessory_type_cd": "hat"},
        {"category_cd": "top", "accessory_type_cd": "hat"},
    ],
)
async def test_accessory_type_on_non_accessories_is_rejected(repo, body):
    with pytest.raises(AccessoryTypeNotAllowedError):
        await _update(repo, **body)

    assert repo.updates == []


async def test_accessory_type_can_be_set_with_accessories(repo):
    await _update(repo, category_cd="accessories", accessory_type_cd="hat")

    assert repo.updates == [(5, {"category_cd": "accessories", "accessory_type_cd": "hat"})]


async def test_changing_color_clears_color_text_unless_sent(repo):
    await _update(repo, color_cd="navy")
    await _update(repo, color_cd="navy", color_text="곤색")
    await _update(repo, color_cd="white")

    assert repo.updates == [
        (5, {"color_cd": "navy", "color_text": None}),
        (5, {"color_cd": "navy", "color_text": "곤색"}),
        (5, {"color_cd": "white"}),
    ]


@pytest.mark.parametrize("status", ["processing", "failed"])
async def test_unfinished_clothing_is_not_editable(repo, status):
    repo.clothing = _clothing(processing_status_cd=status)

    with pytest.raises(ClothingNotEditableError):
        await _update(repo, item_name="x")
    with pytest.raises(ClothingNotEditableError):
        await edit.save_edit(_FakeDb(), None, MEMBER_ID, 5, ClothingEditUpdate(rotation_angle=0))
    with pytest.raises(ClothingNotEditableError):
        await edit.reset_edit(_FakeDb(), None, MEMBER_ID, 5)

    assert repo.updates == [] and repo.transforms == [] and repo.deleted_edits == []


async def test_missing_clothing_is_not_found(repo):
    repo.clothing = None

    with pytest.raises(ClothingNotFoundError):
        await _update(repo, item_name="x")
    with pytest.raises(ClothingNotFoundError):
        await edit.mark_reviewed(_FakeDb(), MEMBER_ID, 5)


@pytest.mark.parametrize(("status", "expected"), [("completed", [5]), ("processing", [])])
async def test_mark_reviewed_only_for_completed(repo, status, expected):
    repo.clothing = _clothing(processing_status_cd=status)

    await edit.mark_reviewed(_FakeDb(), MEMBER_ID, 5)

    assert repo.reviewed == expected


async def test_save_edit_stores_transform_as_plain_json(repo):
    body = ClothingEditUpdate(
        rotation_angle=Decimal("-90.5"),
        perspective_param={"corners": [[0, 0], [1, 0], [1, 1], [0, 1]]},
    )

    await edit.save_edit(_FakeDb(), None, MEMBER_ID, 5, body)

    assert repo.transforms == [(5, Decimal("-90.5"), {"corners": ((0, 0), (1, 0), (1, 1), (0, 1))})]
    assert repo.reviewed == [5]


async def test_save_edit_without_perspective_clears_it(repo):
    await edit.save_edit(_FakeDb(), None, MEMBER_ID, 5, ClothingEditUpdate(rotation_angle=45))

    assert repo.transforms == [(5, Decimal(45), None)]


def _png(size, mode="L") -> io.BytesIO:
    out = io.BytesIO()
    Image.new(mode, size, 255).save(out, format="PNG")
    out.seek(0)
    return out


async def test_save_mask_stores_grayscale_png_and_removes_previous(repo, storage, tmp_path):
    old = tmp_path / "clothing/7/old_mask.png"
    old.write_bytes(b"old")
    repo.edit = ClothingEditRow(Decimal(0), None, "clothing/7/old_mask.png")

    await edit.save_mask(_FakeDb(), storage, MEMBER_ID, 5, _png((40, 60), "RGBA"))

    [(clothing_id, key)] = repo.masks
    assert clothing_id == 5 and key.startswith("clothing/7/") and key.endswith("_mask.png")
    saved = Image.open(tmp_path / key)
    assert (saved.format, saved.mode, saved.size) == ("PNG", "L", (40, 60))
    assert not old.exists()
    assert repo.reviewed == [5]


async def test_mask_size_must_match_clothing_image(repo, storage, tmp_path):
    with pytest.raises(MaskSizeMismatchError):
        await edit.save_mask(_FakeDb(), storage, MEMBER_ID, 5, _png((60, 40)))

    assert repo.masks == []
    assert list((tmp_path / "clothing/7").glob("*_mask.png")) == []


async def test_mask_size_uses_origin_when_cutout_is_missing(repo, storage, tmp_path):
    Image.new("RGB", (10, 20)).save(tmp_path / "clothing/7/a.webp", format="WEBP")
    repo.clothing = _clothing(cutout_image_url=None)

    await edit.save_mask(_FakeDb(), storage, MEMBER_ID, 5, _png((10, 20)))

    assert len(repo.masks) == 1


async def test_non_png_mask_is_rejected(repo, storage):
    jpeg = io.BytesIO()
    Image.new("RGB", (40, 60)).save(jpeg, format="JPEG")
    jpeg.seek(0)

    with pytest.raises(InvalidMaskError):
        await edit.save_mask(_FakeDb(), storage, MEMBER_ID, 5, jpeg)


async def test_mask_file_is_removed_when_db_fails(repo, storage, tmp_path):
    repo.mask_error = ConnectionError("db gone")

    with pytest.raises(ConnectionError):
        await edit.save_mask(_FakeDb(), storage, MEMBER_ID, 5, _png((40, 60)))

    assert list((tmp_path / "clothing/7").glob("*_mask.png")) == []


async def test_reset_deletes_edit_and_mask_file(repo, storage, tmp_path):
    mask = tmp_path / "clothing/7/old_mask.png"
    mask.write_bytes(b"old")
    repo.edit = ClothingEditRow(Decimal(30), None, "clothing/7/old_mask.png")

    await edit.reset_edit(_FakeDb(), storage, MEMBER_ID, 5)

    assert repo.deleted_edits == [5]
    assert not mask.exists()
    assert repo.reviewed == [5]


async def test_reset_without_edit_is_harmless(repo, storage):
    await edit.reset_edit(_FakeDb(), storage, MEMBER_ID, 5)

    assert repo.deleted_edits == [5]


async def test_too_large_mask_says_so(repo, storage, monkeypatch):
    monkeypatch.setattr(edit.get_settings(), "CLOTHING_UPLOAD_MAX_BYTES", 10)

    with pytest.raises(MaskTooLargeError) as error:
        await edit.save_mask(_FakeDb(), storage, MEMBER_ID, 5, _png((40, 60)))

    assert "용량" in error.value.message


async def test_unreadable_mask_says_so(repo, storage):
    with pytest.raises(InvalidMaskError) as error:
        await edit.save_mask(_FakeDb(), storage, MEMBER_ID, 5, io.BytesIO(b"not an image"))

    assert "읽을 수 없습니다" in error.value.message


async def test_mask_is_decoded_on_the_shared_image_pool(repo, storage, monkeypatch):
    threads = []
    original = edit.normalize_mask

    def spy(data, *, expected_size):
        threads.append(threading.current_thread().name)
        return original(data, expected_size=expected_size)

    monkeypatch.setattr(edit, "normalize_mask", spy)

    await edit.save_mask(_FakeDb(), storage, MEMBER_ID, 5, _png((40, 60)))

    assert threads[0].startswith("clothing-image")


def test_update_fields_match_editable_columns():
    fields = set(ClothingUpdate.model_fields)

    assert fields == set(clothing_repo.EDITABLE_ATTRIBUTE_COLUMNS) | {"style_cds", "season_cds"}
