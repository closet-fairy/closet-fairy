"""에센셜 이미지 시드·마이그레이션과 이미지 파일이 서로 맞는지 확인한다."""

import re
from pathlib import Path

from PIL import Image

BACKEND = Path(__file__).resolve().parent.parent
IMAGE_DIR = BACKEND / "db" / "seeds" / "essential_images"
SEED = BACKEND / "db" / "seeds" / "003_essential.sql"
MIGRATION = BACKEND / "db" / "migrations" / "014_essential_images.sql"
KEY_PATTERN = re.compile(r"'(essential/[a-z0-9-]+\.webp)'")


def _keys(sql_path: Path) -> list[str]:
    return KEY_PATTERN.findall(sql_path.read_text(encoding="utf-8"))


def _seed_items() -> dict[str, str]:
    rows = re.findall(
        r"^\s*\('([^']+)',.*'(essential/[a-z0-9-]+\.webp)', TRUE\)",
        SEED.read_text(encoding="utf-8"),
        flags=re.MULTILINE,
    )
    return dict(rows)


def _migration_items() -> dict[str, str]:
    rows = re.findall(
        r"SELECT '([^']+)',?(?: AS item_name,)?\s+'(essential/[a-z0-9-]+\.webp)'",
        MIGRATION.read_text(encoding="utf-8"),
    )
    return dict(rows)


def test_seed_gives_every_essential_an_image():
    item_rows = re.findall(r"^\s*\('", SEED.read_text(encoding="utf-8"), flags=re.MULTILINE)
    keys = _keys(SEED)
    assert len(keys) == len(item_rows) == 35
    assert len(set(keys)) == len(keys)


def test_migration_matches_seed():
    assert _migration_items() == _seed_items()


def test_every_key_has_a_file_and_no_file_is_unused():
    files = {f"essential/{p.name}" for p in IMAGE_DIR.glob("*.webp")}
    assert files == set(_keys(SEED))


def test_images_are_transparent_webp():
    for path in IMAGE_DIR.glob("*.webp"):
        with Image.open(path) as image:
            assert image.format == "WEBP", path.name
            assert image.mode == "RGBA", path.name
            assert image.getchannel("A").getextrema()[0] == 0, path.name
            assert max(image.size) <= 1200, path.name
