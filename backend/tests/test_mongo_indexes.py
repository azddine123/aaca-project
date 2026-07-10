"""
Unit tests for the notes text index (CORRECTIONS.txt item 31).

MongoDB's text-search stemmers don't cover Arabic, so a single
default_language biases relevance/tokenization toward that one language.
_create_notes_text_index() must produce default_language="none" (uniform
tokenization for all languages) and must transparently migrate a
pre-existing index that still has the old default_language="french"
(which raises IndexOptionsConflict / code 85 if left untouched).

mongodb_service.db is mocked here rather than hit for real: this method's
correctness (which calls are made, in which order) is fully verifiable
without a live database, consistent with the rest of the test suite.
Verified once against a real MongoDB during development — see
memory/security-fixes-2026-07-08.md.
"""
from unittest.mock import AsyncMock, MagicMock

import pytest
from pymongo.errors import OperationFailure

from app.services.mongodb_service import mongodb_service

_TEXT_KEY = [("_fts", "text"), ("_ftsx", 1)]


@pytest.fixture
def fake_db(monkeypatch):
    db = MagicMock()
    db.notes = MagicMock()
    db.notes.create_index = AsyncMock()
    db.notes.drop_index = AsyncMock()
    db.notes.index_information = AsyncMock(return_value={})
    monkeypatch.setattr(mongodb_service, "db", db)
    return db


class TestNotesTextIndex:

    @pytest.mark.asyncio
    async def test_creates_index_with_no_default_language(self, fake_db):
        """Fresh install (no pre-existing index) — single create_index call."""
        await mongodb_service._create_notes_text_index()

        fake_db.notes.create_index.assert_awaited_once_with(
            [("title", "text"), ("raw_text", "text")], default_language="none"
        )
        fake_db.notes.drop_index.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_migrates_legacy_language_specific_index(self, fake_db):
        """A pre-existing default_language="french" index conflicts (code 85)
        and must be dropped, then recreated with default_language="none"."""
        fake_db.notes.create_index.side_effect = [
            OperationFailure("IndexOptionsConflict", code=85),
            None,
        ]
        fake_db.notes.index_information.return_value = {
            "title_text_raw_text_text": {
                "key": _TEXT_KEY,
                "default_language": "french",
            },
        }

        await mongodb_service._create_notes_text_index()

        fake_db.notes.drop_index.assert_awaited_once_with("title_text_raw_text_text")
        assert fake_db.notes.create_index.await_count == 2
        for call in fake_db.notes.create_index.await_args_list:
            assert call.kwargs == {"default_language": "none"}

    @pytest.mark.asyncio
    async def test_other_operation_failures_are_not_swallowed(self, fake_db):
        """Only IndexOptionsConflict (code 85) is handled — anything else propagates."""
        fake_db.notes.create_index.side_effect = OperationFailure("boom", code=13)

        with pytest.raises(OperationFailure):
            await mongodb_service._create_notes_text_index()

        fake_db.notes.drop_index.assert_not_awaited()
