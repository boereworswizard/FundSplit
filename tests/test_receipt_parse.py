"""Tests for validating AI receipt output (no Home Assistant needed)."""

from datetime import date, timedelta
import importlib
from pathlib import Path
import sys
import types

import pytest

# Stub package so the HA-dependent __init__.py is never executed.
_dir = Path(__file__).parent.parent / "custom_components" / "fundsplit"
_pkg = types.ModuleType("fundsplit_pkg")
_pkg.__path__ = [str(_dir)]
sys.modules["fundsplit_pkg"] = _pkg
parse = importlib.import_module("fundsplit_pkg.receipt_parse")
LedgerError = importlib.import_module("fundsplit_pkg.ledger").LedgerError


def test_full_result():
    out = parse.parse_receipt_result(
        {"total": 249.9, "merchant": " Woolworths ", "date": "2025-03-02", "category": "groceries"}
    )
    assert out == {
        "amount": 249.9,
        "description": "Woolworths",
        "date": "2025-03-02",
        "category": "Groceries",
    }


def test_total_as_string_with_rounding():
    assert parse.parse_receipt_result({"total": "100.005"})["amount"] == 100.01


@pytest.mark.parametrize("bad", [None, {}, {"total": 0}, {"total": -5}, {"total": "abc"}, "text"])
def test_missing_or_invalid_total_raises(bad):
    with pytest.raises(LedgerError):
        parse.parse_receipt_result(bad)


def test_bad_optional_fields_are_dropped():
    future = (date.today() + timedelta(days=3)).isoformat()
    out = parse.parse_receipt_result(
        {"total": 10, "merchant": "", "date": future, "category": "Nonsense"}
    )
    assert out == {"amount": 10.0}


def test_garbage_date_dropped():
    assert "date" not in parse.parse_receipt_result({"total": 10, "date": "02/03/25"})


def test_merchant_truncated():
    assert len(parse.parse_receipt_result({"total": 1, "merchant": "x" * 200})["description"]) == 80
