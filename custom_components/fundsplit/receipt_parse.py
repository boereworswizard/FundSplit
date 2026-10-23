"""Pure helpers for turning AI output into a safe expense draft."""

from __future__ import annotations

from datetime import date as date_cls
from typing import Any

from .ledger import CATEGORIES, LedgerError, to_cents

RECEIPT_INSTRUCTIONS = (
    "You are reading a photo of a shopping or restaurant receipt from South Africa. "
    "Extract: the final total the customer paid in South African rand (ZAR) as a plain number "
    "(include VAT, the amount due or paid, NOT the subtotal and NOT the change or tendered cash), "
    "the merchant name, the purchase date as YYYY-MM-DD, and the best-fitting category. "
    f"Category must be one of: {', '.join(CATEGORIES)}. "
    "If a value is not legible, omit it rather than guessing."
)


def parse_receipt_result(data: Any) -> dict[str, Any]:
    """Validate the AI's structured output; only keep fields that are sane.

    Raises LedgerError if no usable total was found.
    """
    if not isinstance(data, dict):
        raise LedgerError("The AI agent returned an unexpected response")
    try:
        cents = to_cents(data.get("total"))
    except LedgerError:
        cents = 0
    if cents <= 0:
        raise LedgerError("Couldn't read a total from that receipt - try a clearer photo")

    result: dict[str, Any] = {"amount": cents / 100}
    merchant = str(data.get("merchant") or "").strip()
    if merchant:
        result["description"] = merchant[:80]
    raw_date = str(data.get("date") or "").strip()
    try:
        parsed = date_cls.fromisoformat(raw_date)
    except ValueError:
        parsed = None
    if parsed and parsed <= date_cls.today():
        result["date"] = parsed.isoformat()
    category = str(data.get("category") or "").strip()
    match = next((c for c in CATEGORIES if c.casefold() == category.casefold()), None)
    if match:
        result["category"] = match
    return result
