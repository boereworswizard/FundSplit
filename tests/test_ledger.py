"""Tests for the pure-Python ledger (no Home Assistant needed)."""

import importlib.util
from pathlib import Path

import pytest

# Load ledger.py directly so the tests don't import the HA-dependent package.
_spec = importlib.util.spec_from_file_location(
    "ledger",
    Path(__file__).parent.parent / "custom_components" / "fundsplit" / "ledger.py",
)
ledger = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ledger)

Ledger = ledger.Ledger
LedgerError = ledger.LedgerError


@pytest.fixture
def lg():
    return Ledger(
        [
            {"id": "a", "name": "Alex", "person": "person.alex"},
            {"id": "s", "name": "Sam", "person": None},
        ]
    )


def test_to_cents_rounds_half_up():
    assert ledger.to_cents(10) == 1000
    assert ledger.to_cents("12.345") == 1235
    assert ledger.to_cents(0.1 + 0.2) == 30


def test_to_cents_rejects_garbage():
    with pytest.raises(LedgerError):
        ledger.to_cents("abc")


def test_allocate_sums_exactly():
    from fractions import Fraction

    shares = ledger.allocate(1000, [Fraction(1)] * 3)
    assert sum(shares) == 1000
    assert sorted(shares) == [333, 333, 334]


def test_equal_split_odd_cent(lg):
    exp = lg.add_expense("Milk", "0.05", "a")
    assert sum(exp["split"].values()) == 5
    assert sorted(exp["split"].values()) == [2, 3]


def test_equal_split_balances(lg):
    lg.add_expense("Groceries", 100, "a")
    assert lg.balances() == {"a": 5000, "s": -5000}


def test_other_owes_all_via_shares(lg):
    lg.add_expense("Sam's gift", 200, "a", "shares", {"a": 0, "s": 1})
    assert lg.balances() == {"a": 20000, "s": -20000}


def test_percent_split(lg):
    exp = lg.add_expense("Rent", 1000, "a", "percent", {"a": 60, "s": 40})
    assert exp["split"] == {"a": 60000, "s": 40000}
    assert lg.balances()["s"] == -40000


def test_percent_must_total_100(lg):
    with pytest.raises(LedgerError):
        lg.add_expense("Rent", 1000, "a", "percent", {"a": 60, "s": 30})


def test_exact_split(lg):
    exp = lg.add_expense("Dinner", "250.50", "s", "exact", {"a": "100.25", "s": "150.25"})
    assert exp["split"] == {"a": 10025, "s": 15025}


def test_exact_must_total_amount(lg):
    with pytest.raises(LedgerError):
        lg.add_expense("Dinner", 100, "a", "exact", {"a": 10, "s": 10})


def test_settlement_clears_balance(lg):
    lg.add_expense("Groceries", 100, "a")
    lg.add_settlement("s", "a", 50)
    assert lg.balances() == {"a": 0, "s": 0}
    assert lg.simplify() == []


def test_partial_settlement(lg):
    lg.add_expense("Groceries", 100, "a")
    lg.add_settlement("Sam", "Alex", 20)
    assert lg.simplify() == [{"from": "s", "to": "a", "amount": 3000}]


def test_balances_net_across_payers(lg):
    lg.add_expense("One", 100, "a")
    lg.add_expense("Two", 40, "s")
    assert lg.balances() == {"a": 3000, "s": -3000}


def test_soft_delete_reverts_balance(lg):
    exp = lg.add_expense("Oops", 100, "a")
    lg.delete(exp["id"])
    assert lg.balances() == {"a": 0, "s": 0}
    assert lg.snapshot()["activity"] == []
    with pytest.raises(LedgerError):
        lg.delete(exp["id"])


def test_resolve_member_by_name_id_person(lg):
    assert lg.resolve_member("alex") == "a"
    assert lg.resolve_member("s") == "s"
    assert lg.resolve_member("person.alex") == "a"
    with pytest.raises(LedgerError):
        lg.resolve_member("nobody")


def test_validation(lg):
    with pytest.raises(LedgerError):
        lg.add_expense("Free", 0, "a")
    with pytest.raises(LedgerError):
        lg.add_expense("  ", 10, "a")
    with pytest.raises(LedgerError):
        lg.add_expense("Bad date", 10, "a", date="not-a-date")
    with pytest.raises(LedgerError):
        lg.add_settlement("a", "a", 10)


def test_snapshot_totals_and_order(lg):
    lg.add_expense("Old", 10, "a", date="2020-01-01")
    lg.add_expense("New", 20, "s", date="2021-01-01")
    snap = lg.snapshot()
    assert snap["total_spend"] == 3000
    assert [a["description"] for a in snap["activity"]] == ["New", "Old"]
    assert snap["currency"] == "ZAR"


def test_roundtrip_persistence(lg):
    lg.add_expense("Milk", 12.5, "a")
    restored = Ledger(lg.members, **lg.to_dict())
    assert restored.balances() == lg.balances()


def test_categories():
    cats = ledger.CATEGORIES
    assert "Cannabis" in cats and "Pets" in cats
    assert "Rent" not in cats and "Utilities" not in cats


def test_update_expense_in_place(lg):
    first = lg.add_expense("Milk", 100, "a")
    lg.add_expense("Bread", 40, "s")
    updated = lg.update_expense(
        first["id"], "Milk & eggs", 200, "s", "percent", {"a": 25, "s": 75}, date="2024-05-01"
    )
    assert updated["id"] == first["id"]
    assert lg.expenses[0] is updated  # position preserved
    assert updated["split"] == {"a": 5000, "s": 15000}
    assert updated["split_values"] == {"a": 25, "s": 75}
    # s paid 200 (a owes 50) and 40 (a owes 20): s is owed 70
    assert lg.balances() == {"a": -7000, "s": 7000}


def test_update_expense_balances(lg):
    exp = lg.add_expense("Dinner", 100, "a")
    assert lg.balances() == {"a": 5000, "s": -5000}
    lg.update_expense(exp["id"], "Dinner", 300, "s")
    assert lg.balances() == {"a": -15000, "s": 15000}


def test_update_validates_and_keeps_original_on_error(lg):
    exp = lg.add_expense("Dinner", 100, "a")
    with pytest.raises(LedgerError):
        lg.update_expense(exp["id"], "Dinner", 100, "a", "percent", {"a": 10, "s": 10})
    assert lg.expenses[0]["amount"] == 10000
    assert lg.balances() == {"a": 5000, "s": -5000}


def test_update_missing_or_deleted_raises(lg):
    exp = lg.add_expense("Dinner", 100, "a")
    lg.delete(exp["id"])
    with pytest.raises(LedgerError):
        lg.update_expense(exp["id"], "Dinner", 100, "a")
    with pytest.raises(LedgerError):
        lg.update_expense("nope", "Dinner", 100, "a")


def test_update_settlement(lg):
    lg.add_expense("Groceries", 100, "a")
    st = lg.add_settlement("s", "a", 10)
    lg.update_settlement(st["id"], "s", "a", 50, date="2024-01-02")
    assert lg.balances() == {"a": 0, "s": 0}
    assert lg.settlements[0]["date"] == "2024-01-02"
    with pytest.raises(LedgerError):
        lg.update_settlement(st["id"], "a", "a", 5)
