"""Runtime manager: owns the ledger, persists it and notifies listeners."""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    EVENT_EXPENSE_ADDED,
    EVENT_ITEM_DELETED,
    EVENT_ITEM_UPDATED,
    EVENT_SETTLEMENT_ADDED,
    SIGNAL_UPDATED,
)
from .ledger import Ledger, LedgerError


def _today():
    """Today's date in Home Assistant's configured timezone."""
    return dt_util.now().date()


class FundSplitManager:
    """Wraps a Ledger with persistence, events and dispatcher updates."""

    def __init__(
        self, hass: HomeAssistant, entry_id: str, members: list[dict[str, Any]]
    ) -> None:
        self.hass = hass
        self.entry_id = entry_id
        self._members = members
        self._store: Store = Store(hass, 1, f"fundsplit.{entry_id}")
        self.ledger = Ledger(members, today=_today)

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.ledger = Ledger(
            self._members,
            data.get("expenses", []),
            data.get("settlements", []),
            today=_today,
        )

    async def _async_commit(self) -> None:
        await self._store.async_save(self.ledger.to_dict())
        async_dispatcher_send(self.hass, f"{SIGNAL_UPDATED}_{self.entry_id}")

    def snapshot(self) -> dict[str, Any]:
        return self.ledger.snapshot()

    async def async_actor_name(self, user_id: str | None) -> str | None:
        """Name to tag new entries with: the member linked to the user, else the HA user."""
        if not user_id:
            return "Automation"
        for state in self.hass.states.async_all("person"):
            if state.attributes.get("user_id") != user_id:
                continue
            for member in self._members:
                if member.get("person") == state.entity_id:
                    return member["name"]
        user = await self.hass.auth.async_get_user(user_id)
        return user.name if user else None

    async def async_add_expense(self, **kwargs: Any) -> dict[str, Any]:
        expense = self.ledger.add_expense(**kwargs)
        await self._async_commit()
        self.hass.bus.async_fire(
            EVENT_EXPENSE_ADDED,
            {
                "id": expense["id"],
                "description": expense["description"],
                "amount": expense["amount"] / 100,
                "paid_by": self.ledger.member_name(expense["paid_by"]),
                "category": expense["category"],
            },
        )
        return expense

    async def async_update_expense(self, **kwargs: Any) -> dict[str, Any]:
        expense = self.ledger.update_expense(**kwargs)
        await self._async_commit()
        self.hass.bus.async_fire(EVENT_ITEM_UPDATED, {"id": expense["id"]})
        return expense

    async def async_update_settlement(self, **kwargs: Any) -> dict[str, Any]:
        settlement = self.ledger.update_settlement(**kwargs)
        await self._async_commit()
        self.hass.bus.async_fire(EVENT_ITEM_UPDATED, {"id": settlement["id"]})
        return settlement

    async def async_add_settlement(self, **kwargs: Any) -> dict[str, Any]:
        settlement = self.ledger.add_settlement(**kwargs)
        await self._async_commit()
        self.hass.bus.async_fire(
            EVENT_SETTLEMENT_ADDED,
            {
                "id": settlement["id"],
                "from": self.ledger.member_name(settlement["from"]),
                "to": self.ledger.member_name(settlement["to"]),
                "amount": settlement["amount"] / 100,
            },
        )
        return settlement

    async def async_settle_all(self, created_by: str | None = None) -> dict[str, Any]:
        """Record a settlement for the full outstanding balance."""
        payments = self.ledger.simplify()
        if not payments:
            raise LedgerError("Nothing to settle: balances are already even")
        pay = payments[0]
        return await self.async_add_settlement(
            from_member=pay["from"],
            to_member=pay["to"],
            amount=pay["amount"] / 100,
            created_by=created_by,
        )

    async def async_delete(self, item_id: str) -> None:
        self.ledger.delete(item_id)
        await self._async_commit()
        self.hass.bus.async_fire(EVENT_ITEM_DELETED, {"id": item_id})
