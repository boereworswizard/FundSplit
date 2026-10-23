"""Pure-Python ledger for FundSplit. No Home Assistant imports.

All money is stored as integer cents (ZAR). Public inputs are in rands.
Balances are signed: positive means the member is owed money, negative
means the member owes money.
"""

from __future__ import annotations

from datetime import date as date_cls
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from fractions import Fraction
from typing import Any
import uuid

MODE_EQUAL = "equal"
MODE_SHARES = "shares"
MODE_PERCENT = "percent"
MODE_EXACT = "exact"
SPLIT_MODES = (MODE_EQUAL, MODE_SHARES, MODE_PERCENT, MODE_EXACT)

CATEGORIES = (
    "Groceries",
    "Eating out",
    "Transport",
    "Fun",
    "Cannabis",
    "Home",
    "Other",
)


class LedgerError(ValueError):
    """Raised for invalid ledger operations."""


def to_cents(value: Any) -> int:
    """Convert a rand amount (int, float, str, Decimal) to integer cents."""
    try:
        dec = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError) as err:
        raise LedgerError(f"Invalid amount: {value!r}") from err
    return int(dec * 100)


def allocate(total: int, weights: list[Fraction]) -> list[int]:
    """Split ``total`` cents by ``weights`` using the largest-remainder method.

    The result always sums exactly to ``total``.
    """
    if total < 0:
        raise LedgerError("Cannot allocate a negative amount")
    if any(w < 0 for w in weights):
        raise LedgerError("Weights cannot be negative")
    weight_sum = sum(weights)
    if weight_sum <= 0:
        raise LedgerError("At least one weight must be positive")
    shares = [int(total * w // weight_sum) for w in weights]
    leftover = total - sum(shares)
    order = sorted(
        range(len(weights)), key=lambda i: (-((total * weights[i]) % weight_sum), i)
    )
    for i in order[:leftover]:
        shares[i] += 1
    return shares


def _fraction(value: Any) -> Fraction:
    try:
        return Fraction(str(value))
    except (ValueError, ZeroDivisionError) as err:
        raise LedgerError(f"Invalid number: {value!r}") from err


def compute_split(
    amount_cents: int,
    member_ids: list[str],
    mode: str = MODE_EQUAL,
    values: dict[str, Any] | None = None,
) -> dict[str, int]:
    """Return how many cents each member owes for an expense.

    * ``equal``   - everyone owes the same share.
    * ``shares``  - ``values`` are relative weights (0 = owes nothing).
    * ``percent`` - ``values`` are percentages and must sum to 100.
    * ``exact``   - ``values`` are rand amounts and must sum to the total.
    """
    values = values or {}
    unknown = set(values) - set(member_ids)
    if unknown:
        raise LedgerError(f"Unknown members in split: {sorted(unknown)}")

    if mode == MODE_EQUAL:
        weights = [Fraction(1)] * len(member_ids)
    elif mode == MODE_SHARES:
        weights = [_fraction(values.get(m, 0)) for m in member_ids]
    elif mode == MODE_PERCENT:
        weights = [_fraction(values.get(m, 0)) for m in member_ids]
        if sum(weights) != 100:
            raise LedgerError("Percentages must add up to 100")
    elif mode == MODE_EXACT:
        owed = [to_cents(values.get(m, 0)) for m in member_ids]
        if any(c < 0 for c in owed):
            raise LedgerError("Exact amounts cannot be negative")
        if sum(owed) != amount_cents:
            raise LedgerError("Exact amounts must add up to the expense total")
        return dict(zip(member_ids, owed, strict=True))
    else:
        raise LedgerError(f"Unknown split mode: {mode}")

    return dict(zip(member_ids, allocate(amount_cents, weights), strict=True))


class Ledger:
    """A two-(or more)-person expense ledger."""

    def __init__(
        self,
        members: list[dict[str, Any]],
        expenses: list[dict[str, Any]] | None = None,
        settlements: list[dict[str, Any]] | None = None,
    ) -> None:
        if len(members) < 2:
            raise LedgerError("A ledger needs at least two members")
        self.members = members
        self.expenses = expenses if expenses is not None else []
        self.settlements = settlements if settlements is not None else []

    # -- members ---------------------------------------------------------

    @property
    def member_ids(self) -> list[str]:
        return [m["id"] for m in self.members]

    def resolve_member(self, ref: str) -> str:
        """Resolve an id, name or person entity_id to a member id."""
        needle = str(ref).strip().casefold()
        for member in self.members:
            candidates = (member["id"], member["name"], member.get("person") or "")
            if needle in (c.casefold() for c in candidates if c):
                return member["id"]
        raise LedgerError(f"Unknown member: {ref!r}")

    def member_name(self, member_id: str) -> str:
        for member in self.members:
            if member["id"] == member_id:
                return member["name"]
        raise LedgerError(f"Unknown member id: {member_id!r}")

    # -- mutations -------------------------------------------------------

    def _build_expense(
        self,
        item_id: str,
        description: str,
        amount: Any,
        paid_by: str,
        mode: str,
        values: dict[str, Any] | None,
        date: str | None,
        category: str | None,
    ) -> dict[str, Any]:
        cents = to_cents(amount)
        if cents <= 0:
            raise LedgerError("Amount must be greater than zero")
        description = (description or "").strip()
        if not description:
            raise LedgerError("Description is required")
        payer = self.resolve_member(paid_by)
        resolved_values = (
            {self.resolve_member(k): v for k, v in values.items()} if values else None
        )
        split = compute_split(cents, self.member_ids, mode, resolved_values)
        return {
            "id": item_id,
            "description": description,
            "amount": cents,
            "paid_by": payer,
            "split": split,
            "split_mode": mode,
            "split_values": resolved_values,
            "date": _valid_date(date),
            "category": category or None,
            "deleted": False,
        }

    def add_expense(
        self,
        description: str,
        amount: Any,
        paid_by: str,
        mode: str = MODE_EQUAL,
        values: dict[str, Any] | None = None,
        date: str | None = None,
        category: str | None = None,
    ) -> dict[str, Any]:
        expense = self._build_expense(
            uuid.uuid4().hex, description, amount, paid_by, mode, values, date, category
        )
        self.expenses.append(expense)
        return expense

    def update_expense(
        self,
        item_id: str,
        description: str,
        amount: Any,
        paid_by: str,
        mode: str = MODE_EQUAL,
        values: dict[str, Any] | None = None,
        date: str | None = None,
        category: str | None = None,
    ) -> dict[str, Any]:
        """Replace an active expense in place (same id and list position)."""
        for i, old in enumerate(self.expenses):
            if old["id"] == item_id and not old["deleted"]:
                new = self._build_expense(
                    item_id, description, amount, paid_by, mode, values, date, category
                )
                self.expenses[i] = new
                return new
        raise LedgerError(f"No active expense with id {item_id!r}")

    def _build_settlement(
        self,
        item_id: str,
        from_member: str,
        to_member: str,
        amount: Any,
        date: str | None,
    ) -> dict[str, Any]:
        cents = to_cents(amount)
        if cents <= 0:
            raise LedgerError("Amount must be greater than zero")
        payer = self.resolve_member(from_member)
        payee = self.resolve_member(to_member)
        if payer == payee:
            raise LedgerError("Cannot settle up with yourself")
        return {
            "id": item_id,
            "from": payer,
            "to": payee,
            "amount": cents,
            "date": _valid_date(date),
            "deleted": False,
        }

    def add_settlement(
        self, from_member: str, to_member: str, amount: Any, date: str | None = None
    ) -> dict[str, Any]:
        settlement = self._build_settlement(
            uuid.uuid4().hex, from_member, to_member, amount, date
        )
        self.settlements.append(settlement)
        return settlement

    def update_settlement(
        self,
        item_id: str,
        from_member: str,
        to_member: str,
        amount: Any,
        date: str | None = None,
    ) -> dict[str, Any]:
        for i, old in enumerate(self.settlements):
            if old["id"] == item_id and not old["deleted"]:
                new = self._build_settlement(item_id, from_member, to_member, amount, date)
                self.settlements[i] = new
                return new
        raise LedgerError(f"No active settlement with id {item_id!r}")

    def delete(self, item_id: str) -> dict[str, Any]:
        """Soft-delete an expense or settlement by id."""
        for item in (*self.expenses, *self.settlements):
            if item["id"] == item_id and not item["deleted"]:
                item["deleted"] = True
                return item
        raise LedgerError(f"No active expense or settlement with id {item_id!r}")

    # -- queries ---------------------------------------------------------

    def balances(self) -> dict[str, int]:
        bal = dict.fromkeys(self.member_ids, 0)
        for exp in self.expenses:
            if exp["deleted"]:
                continue
            bal[exp["paid_by"]] += exp["amount"]
            for member, owed in exp["split"].items():
                bal[member] -= owed
        for st in self.settlements:
            if st["deleted"]:
                continue
            bal[st["from"]] += st["amount"]
            bal[st["to"]] -= st["amount"]
        return bal

    def simplify(self) -> list[dict[str, Any]]:
        """Greedy debt simplification: list of ``{from, to, amount}`` payments."""
        bal = self.balances()
        debtors = sorted((m for m in bal if bal[m] < 0), key=lambda m: bal[m])
        creditors = sorted((m for m in bal if bal[m] > 0), key=lambda m: -bal[m])
        owe = {m: -bal[m] for m in debtors}
        due = {m: bal[m] for m in creditors}
        payments: list[dict[str, Any]] = []
        d = c = 0
        while d < len(debtors) and c < len(creditors):
            amount = min(owe[debtors[d]], due[creditors[c]])
            payments.append({"from": debtors[d], "to": creditors[c], "amount": amount})
            owe[debtors[d]] -= amount
            due[creditors[c]] -= amount
            if owe[debtors[d]] == 0:
                d += 1
            if due[creditors[c]] == 0:
                c += 1
        return payments

    def total_spend(self, month: str | None = None) -> int:
        """Total of active expenses, optionally limited to a ``YYYY-MM`` month."""
        return sum(
            e["amount"]
            for e in self.expenses
            if not e["deleted"] and (month is None or e["date"].startswith(month))
        )

    def snapshot(self) -> dict[str, Any]:
        """JSON-serialisable view used by the websocket API and the panel."""
        current_month = date_cls.today().strftime("%Y-%m")
        activity = [
            {**e, "type": "expense"} for e in self.expenses if not e["deleted"]
        ] + [{**s, "type": "settlement"} for s in self.settlements if not s["deleted"]]
        activity.sort(key=lambda a: a["date"], reverse=True)  # stable: keeps order
        return {
            "currency": "ZAR",
            "categories": list(CATEGORIES),
            "members": self.members,
            "balances": self.balances(),
            "payments": self.simplify(),
            "total_spend": self.total_spend(),
            "month_spend": self.total_spend(current_month),
            "activity": activity,
        }

    def to_dict(self) -> dict[str, Any]:
        """Persistable data (members live in the config entry)."""
        return {"expenses": self.expenses, "settlements": self.settlements}


def _valid_date(value: str | None) -> str:
    if not value:
        return date_cls.today().isoformat()
    try:
        return date_cls.fromisoformat(str(value)).isoformat()
    except ValueError as err:
        raise LedgerError(f"Invalid date: {value!r}") from err
